# frozen_string_literal: true

module ShiritoriRules
  # 単語が入力されているかを判定するルール
  class PresenceRule < BaseRule
    def validate
      # もし@new_wordが空なら、エラーメッセージを返す
      if @new_word.blank?
        { status: :error, message: '単語を入力してください。' }
      end
      # 問題なければ何も返さない
    end
  end
end
