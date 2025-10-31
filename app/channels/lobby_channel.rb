require_relative 'application_cable/channel'

class LobbyChannel < ApplicationCable::Channel
  # "lobby_channel"という名前のチャンネルに接続があった時に呼ばれるメソッド
  def subscribed
    stream_from 'lobby_channel'
  end

  # 接続が切れた時に呼ばれるメソッド
  def unsubscribed
    # Any cleanup needed when channel is unsubscribed
  end
end
