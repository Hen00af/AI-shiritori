class ApplicationController < ActionController::Base
  include GuestUserConcern

  before_action :configure_permitted_parameters, if: :devise_controller?
  before_action :ensure_guest_user_info

  protected

  def configure_permitted_parameters
    # サインアップ時に username を許可
    devise_parameter_sanitizer.permit(:sign_up, keys: [:username])

    # プロフィール編集時にも username を許可（必要なら）
    devise_parameter_sanitizer.permit(:account_update, keys: [:username])
  end

  # ログイン後の遷移先
  def after_sign_in_path_for(resource)
    rooms_path
  end
end
