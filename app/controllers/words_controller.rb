# app/controllers/words_controller.rb

class WordsController < ApplicationController
  def create
    room = Room.find(word_params[:room_id])
    new_word = word_params[:body]

    unless room.playing?
      return head :bad_request if request.format.json?

      return
    end

    room_participant = RoomParticipant.find(word_params[:room_participant_id])
    logic = ShiritoriLogic.new(room, room_participant)
    result = logic.validate(new_word)

    case result[:status]
    when :success
      score = 100 + ((new_word.length**2) * 10)
      @word_record = room.words.create(
        body: new_word,
        score: score,
        room_participant: room_participant,
        user: room_participant.user
      )

      word_html = render_to_string(partial: 'words/word', formats: [:html], locals: { word: @word_record })
      RoomChannel.broadcast_to(room, {
                                 event: 'word_created',
                                 word_html: word_html,
                                 participant_id: @word_record.room_participant_id,
                               })

      head :no_content

    when :game_over
      score = 100 + ((new_word.length**2) * 10)
      word_record = room.words.create!(
        body: new_word,
        score: score,
        room_participant: room_participant,
        user: room_participant.user
      )

      word_html = render_to_string(partial: 'words/word', formats: [:html], locals: { word: word_record })
      RoomChannel.broadcast_to(room, {
                                 event: 'word_created',
                                 word_html: word_html,
                                 participant_id: word_record.room_participant_id,
                               })

      RoomChannel.broadcast_to(room, {
                                 event: 'player_game_over',
                                 user_id: room_participant.user&.id,
                                 guest_id: room_participant.guest_id,
                                 message: result[:message],
                               })

      all_over = room.room_participants.includes(:words).all? do |p|
        last_word = p.words.max_by(&:created_at)
        last_word&.body&.ends_with?('ん')
      end

      if all_over || room.game_mode == 'score_attack'
        RoomChannel.broadcast_to(room, { event: 'all_players_over' })
      end

      head :no_content

    else # validation error
      # フォームを再描画するために、現在の参加者情報を取得する
      @current_participant = if guest_user?
                               room.room_participants.find_by(guest_id: current_guest_id)
                             else
                               room.room_participants.find_by(user_id: current_user.id)
                             end

      render turbo_stream: [
        turbo_stream.update('flash-messages',
                            partial: 'layouts/flash',
                            locals: { message: result[:message], type: 'warning' }),
        # locals に @current_participant を追加してパーシャルに渡す
        turbo_stream.replace('word_form',
                             partial: 'rooms/word_form',
                             locals: { room: room, current_participant: @current_participant }),
      ], status: :unprocessable_entity
    end
  end

  private

  def word_params
    params.require(:word).permit(:body, :room_id, :room_participant_id)
  end
end
