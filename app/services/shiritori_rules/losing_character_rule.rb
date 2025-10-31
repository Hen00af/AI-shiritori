# frozen_string_literal: true

module ShiritoriRules
  # 「ん」で終わる単語かどうかを判定するルール
  class LosingCharacterRule < BaseRule
    def validate
      # もし「ん」で終わっていたら、ゲームオーバー用の特別なステータスを返す
      if @new_word.ends_with?('ん')
        { status: :game_over, message: '「ん」で終わる単語です！' }
      end
      # 問題なければ何も返さない
    end
  end
end
