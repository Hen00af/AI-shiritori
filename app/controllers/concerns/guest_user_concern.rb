module GuestUserConcern
  extend ActiveSupport::Concern

  def guest_user?
    !user_signed_in?
  end

  def ensure_guest_user_info
    return if user_signed_in?

    # ゲストIDがない場合は生成
    unless cookies.encrypted[:guest_id]
      cookies.encrypted[:guest_id] = SecureRandom.uuid
      cookies.encrypted[:guest_name] = "ゲスト#{SecureRandom.hex(4)}"
    end
  end
end
