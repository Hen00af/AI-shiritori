module ApplicationCable
  class Connection < ActionCable::Connection::Base
    # ログインユーザーとゲストIDの両方で接続を識別できるようにする
    identified_by :current_user
    identified_by :guest_id

    def connect
      # まずログインユーザーを探す（いなければ nil が入る）
      self.current_user = find_verified_user
      # 次にセッションからゲストIDを取得する
      self.guest_id = request.session.fetch('guest_id', nil)

      # ログインユーザーもゲストIDも、どちらも存在しない場合のみ接続を拒否する
      reject_unauthorized_connection unless current_user || guest_id
    end

    private

    def find_verified_user
      # ログインしていない場合は nil を返す
      env['warden'].user
    end
  end
end
