class RoomParticipant < ApplicationRecord
  belongs_to :room
  belongs_to :user, optional: true # ゲストユーザーの場合はuserがnil

  validates :user_id, uniqueness: { scope: :room_id }, if: :user_id?
  validate :user_or_guest_present

  has_many :words, dependent: :destroy

  def display_name
    if user_id?
      user.username
    else
      guest_name
    end
  end

  private

  def user_or_guest_present
    if user_id.blank? && guest_id.blank?
      errors.add(:base, 'ユーザーまたはゲスト情報が必要です')
    end
  end
end
