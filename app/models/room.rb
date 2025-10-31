class Room < ApplicationRecord
  # status は既存。integer なら以下の enum を使うと便利
  # 既存の値と不一致なら mapping を合わせてください
  enum :status, { waiting: 0, playing: 1, finished: 2 } # rescue nil

  belongs_to :creator, class_name: 'User'

  has_many :words, dependent: :destroy
  has_many :room_participants, dependent: :destroy
  has_many :participants, through: :room_participants, source: :user

  scope :available, -> {
    where(status: :waiting).left_joins(:room_participants)
                           .group(:id).having('COUNT(room_participants.id) < rooms.max_players')
  }

  def full?
    room_participants.count >= max_players
  end
end
