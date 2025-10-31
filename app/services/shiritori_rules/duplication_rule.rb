# frozen_string_literal: true

module ShiritoriRules
  # すでに使用された単語かどうかを判定するルール
  class DuplicationRule < BaseRule
    def validate
      # もし単語が既に使用されていたら、エラーメッセージを返す
      if @words.pluck(:body).include?(@new_word)
        { status: :error, message: 'その単語は既に使用されています。' }
      end
      # 問題なければ何も返さない
    end
  end
end
