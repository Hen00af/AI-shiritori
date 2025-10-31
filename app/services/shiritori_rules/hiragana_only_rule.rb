# frozen_string_literal: true

module ShiritoriRules
  # ひらがなのみで構成されているかを判定するルール
  class HiraganaOnlyRule < BaseRule
    HIRAGANA_ONLY_REGEX = /\A[\u3040-\u309Fー]+\z/

    def validate
      # もし、ひらがなと長音符以外が含まれていたらエラーメッセージを返す
      unless @new_word.match?(HIRAGANA_ONLY_REGEX)
        { status: :error, message: 'ひらがなで入力してください。' }
      end
      # 問題なければ何も返さない
    end
  end
end
