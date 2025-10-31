class ResultChannel < ApplicationCable::Channel
  # クライアントがこのチャンネルの購読を開始したときに呼び出される
  def subscribed
    # JavaScript側から渡される `room_id` を使って、対象のルームをデータベースから見つける
    room = Room.find(params[:room_id])
    # そのルーム専用の情報の通り道（ストリーム）を作成する
    # これにより、このルームに関する更新情報だけを的確に受け取れるようになる
    stream_for room
  end

  # クライアントが購読を解除したときに呼び出される
  def unsubscribed
    # Any cleanup needed when channel is unsubscribed
  end
end
