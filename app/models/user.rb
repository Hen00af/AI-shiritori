class User < ApplicationRecord
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable

  has_many :room_participants, dependent: :destroy
  has_many :rooms, through: :room_participants
  has_many :created_rooms, class_name: 'Room', foreign_key: :creator_id
  has_many :words, dependent: :nullify

  validates :username, presence: true, uniqueness: true
end
