# frozen_string_literal: true

require_relative 'shiritori_rules/presence_rule'
require_relative 'shiritori_rules/hiragana_only_rule'
require_relative 'shiritori_rules/losing_character_rule'
require_relative 'shiritori_rules/connection_rule'
require_relative 'shiritori_rules/duplication_rule'
require_relative 'shiritori_rules/word_length_rule'

class ShiritoriLogic
  RULES = [
    ShiritoriRules::PresenceRule,
    ShiritoriRules::HiraganaOnlyRule,
    ShiritoriRules::WordLengthRule,
    ShiritoriRules::ConnectionRule,
    ShiritoriRules::DuplicationRule,
    ShiritoriRules::LosingCharacterRule,
  ].freeze

  def initialize(room, room_participant)
    @room = room
    @room_participant = room_participant
    @words = @room_participant.words.order(created_at: :asc)
  end

  def validate(new_word)
    RULES.each do |rule_class|
      rule = rule_class.new(new_word, @words)

      if (result = rule.validate)
        return result
      end
    end

    { status: :success, message: 'OK' }
  end
end
