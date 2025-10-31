class RoomsController < ApplicationController
  before_action :set_room, only: %i[show result status]
  before_action :set_words, only: %i[show result]
  protect_from_forgery except: :join

  # ソロモードルーム作成
  def solo
    @room = Room.create!(
      name: 'ソロモード',
      status: :playing,
      max_players: 1,
      creator_id: current_user&.id,
      game_mode: 'score_attack',
      started_at: Time.current + 4.seconds
    )
    participant = if guest_user?
                    @room.room_participants.create!(
                      guest_id: current_guest_id,
                      guest_name: current_guest_name
                    )
                  else
                    @room.room_participants.create!(user: current_user)
                  end
    @room.words.create!(
      body: 'しりとり',
      score: 0,
      room_participant: participant,
      user: participant.user
    )
    redirect_to room_path(@room), notice: 'ソロモードを開始しました'
  end

  def index
    @rooms = Room.available.order(created_at: :desc)
    solo_rooms = Room.where(max_players: 1)
    user_max_scores = {}
    solo_rooms.includes(:room_participants).find_each do |room|
      room.room_participants.each do |participant|
        words = Word.where(room_id: room.id, room_participant_id: participant.id)
        total_score = words.sum(:score).to_i + words.sum(:ai_score).to_i + words.sum(:chain_bonus_score).to_i
        user = participant.user
        next unless user

        if user_max_scores[user.id].nil? || user_max_scores[user.id][:score] < total_score
          user_max_scores[user.id] = { username: user.username, score: total_score }
        end
      end
    end
    @ranking = user_max_scores.values.sort_by { |h| -h[:score] }.first(5)
  end

  def show
    is_participant = if guest_user?
                       @room.room_participants.exists?(guest_id: current_guest_id)
                     else
                       @room.room_participants.exists?(user_id: current_user.id)
                     end

    unless is_participant
      redirect_to rooms_path, alert: 'このルームの参加者ではありません。' and return
    end

    if @room.finished?
      redirect_to result_room_path(@room) and return
    end

    if @room.playing?
      render :show
    else
      render :waiting
    end
  end

  def new
    @room = Room.new
  end

  # ルーム作成 → ホストは待機画面へ
  def create
    room = Room.create!(creator_id: current_user.id, status: :waiting, max_players: 2)
    room.room_participants.create!(user: current_user)

    html = render_to_string(partial: 'rooms/room', locals: { room: room })
    ActionCable.server.broadcast('lobby_channel', { event: 'room_created', room_html: html })

    redirect_to room_path(room), notice: 'ルームを作成しました。相手を待っています…'
  end

  # 参加ボタン
  def join
    room = Room.find(params[:id])

    if room.room_participants.exists?(user_id: current_user.id)
      redirect_to room_path(room) and return
    end

    if (room.respond_to?(:playing?) && room.playing?) || room.full?
      redirect_to root_path, alert: 'このルームは定員に達しています。' and return
    end

    Room.transaction do
      room.lock!
      if room.full?
        redirect_to root_path, alert: 'このルームは定員に達しています。' and return
      end

      room.room_participants.create!(user: current_user)

      participants_html = render_to_string(
        partial: 'rooms/participant',
        collection: room.participants
      )

      RoomChannel.broadcast_to(room, {
                                 event: 'participant_joined',
                                 participants_html: participants_html,
                                 participant_count: room.room_participants.count,
                               })

      if room.full?
        room.update!(status: :playing, started_at: Time.current + 4.seconds) if room.respond_to?(:status)

        ActionCable.server.broadcast('lobby_channel', { event: 'room_removed', room_id: room.id })
        RoomChannel.broadcast_to(room, { event: 'game_started' })

        room.room_participants.includes(:user).find_each do |participant|
          unless room.words.exists?(user: participant.user)
            room.words.create!(body: 'しりとり', score: 0, user: participant.user, room_participant: participant)
          end
        end
      end
    end

    redirect_to room_path(room)
  end

  def status
    render json: {
      status: @room.status,
      participant_count: @room.room_participants.count,
      max_players: @room.max_players,
    }
  end

  def leave
    room = Room.find(params[:id])
    room.room_participants.where(user_id: current_user.id).destroy_all

    if room.reload.room_participants.count.zero?
      room.destroy!
      ActionCable.server.broadcast('lobby_channel', { event: 'room_removed', room_id: room.id })
    end

    redirect_to rooms_path, notice: 'ルームを退出しました。'
  end

  def result
    @room.update!(status: :finished) unless @room.finished?

    words_to_evaluate = @room.words.where.not(score: 0)
    if words_to_evaluate.any? { |w| w.ai_score.nil? || (w.previous_word && w.chain_bonus_score.nil?) }
      words_to_evaluate.each do |word|
        ShiritoriEvaluationJob.perform_later(word) if word.ai_score.nil?
        if word.previous_word && word.chain_bonus_score.nil?
          ShiritoriChainEvaluationJob.perform_later(word, word.previous_word)
        end
      end
    end

    service = ResultBroadcasterService.new(@room)
    results_data = service.build_results_data

    initial_data_for_view = if results_data[:all_words_evaluated]
                              # 何も加工せず、そのまま最終結果を渡す
                              results_data
                            else
                              # まだ評価中の場合は、サービスが提供するメソッドで初期データを取得する
                              service.build_initial_results_data
                            end

    @initial_results_data = {
      event: 'initial_load',
      all_words_evaluated: initial_data_for_view[:all_words_evaluated],
      ranked_results: initial_data_for_view[:ranked_results],
    }.to_json
  end

  private

  def set_room
    @room = Room.find(params[:id])
  end

  def set_words
    return unless @room

    @current_participant = if guest_user?
                             @room.room_participants.find_by(guest_id: current_guest_id)
                           else
                             @room.room_participants.find_by(user_id: current_user.id)
                           end

    @words = @room.words.where(room_participant_id: @current_participant&.id).order(:created_at) || []
  end

  def room_params
    params.require(:room).permit(:name, :game_mode)
  end
end
