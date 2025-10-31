class Word < ApplicationRecord
  belongs_to :room
  belongs_to :user, optional: true
  belongs_to :room_participant

  after_update_commit -> { broadcast_replace_to "word_evaluation_#{id}" }

  validates :body, presence: true
  validates :score, presence: true, numericality: { greater_than_or_equal_to: 0 }

  scope :for_user, ->(user) { where(user: user) }
  scope :ordered, -> { order(:created_at) }

  def previous_word
    room_participant.words.where('created_at < ?', created_at).order(created_at: :desc).first
  end
end
