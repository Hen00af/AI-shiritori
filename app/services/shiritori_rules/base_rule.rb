# frozen_string_literal: true

module ShiritoriRules
  class BaseRule
    def initialize(new_word, words = [])
      @new_word = new_word
      @words = words
    end

    def validate
    end
  end
end
