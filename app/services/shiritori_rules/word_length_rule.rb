# frozen_string_literal: true

module ShiritoriRules
  # 文字数を判定するルール
  class WordLengthRule < BaseRule
    MIN_LENGTH = 2
    MAX_LENGTH = 100

    def validate
      # もし文字数が指定の範囲外なら、エラーメッセージを返す
      return if @new_word.length.between?(MIN_LENGTH, MAX_LENGTH)

      message = if @new_word.length < MIN_LENGTH
                  "#{MIN_LENGTH}文字以上の単語を入力してください。"
                else
                  "単語は#{MAX_LENGTH}文字以内で入力してください。"
                end
      { status: :error, message: message }

      # 問題なければ何も返さない
    end
  end
end
