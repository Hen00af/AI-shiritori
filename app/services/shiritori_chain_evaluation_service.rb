class ShiritoriChainEvaluationService
  def initialize(current_word, previous_word)
    @current_word = current_word
    @previous_word = previous_word
  end

  def evaluate_and_save
    return if @current_word.chain_bonus_score.present? || @previous_word.nil?

    prompt = <<~PROMPT
      # 概要
      あなたは、しりとりゲームの単語の連鎖を評価するAIです。
      「#{@previous_word.body}」→「#{@current_word.body}」の連鎖を分析し、以下の2つを生成してください。

      1.  **評価点:** -10点から10点の間（整数）で評価します。テーマ性、物語性、意外な関連性などを基準とします。
      2.  **評価理由:** なぜその点数になったのか、面白くて納得できる詳細な説明を「ですます調」で記述してください。

      評価理由において、スコア自体は絶対に表記しないでください。(例:〇〇点と評価しました)

      # 出力形式
      「評価点: [点数]」「理由: [評価理由]」の形式を必ず守ってください。
    PROMPT

    begin
      response_text = GeminiCraft.generate_content(prompt)

      base_score = response_text.match(/評価点:\s*(-?\d+)/)&.captures&.first&.to_i
      comment = response_text.match(/理由:\s*(.+)/m)&.captures&.first

      if base_score && comment
        word_jitter = ((@previous_word.body + @current_word.body).bytes.sum % 999) - 499

        final_score = (base_score * 500) + word_jitter

        @current_word.update!(chain_bonus_score: final_score, chain_bonus_comment: comment)
      end
    rescue StandardError => e
      Rails.logger.error "AI連鎖評価中にエラーが発生しました。単語: '#{@current_word.body}', エラー: #{e.message}"
    end
  end
end
