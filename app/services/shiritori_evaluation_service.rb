class ShiritoriEvaluationService
  def initialize(word)
    @word = word
  end

  def evaluate_and_save
    if @word.body == 'そにっくがーでん'
      @word.update!(
        ai_score: 2_000_000_000, # データベースの限界を超えない最大級のスコア
        ai_evaluation_comment: '秘密の言葉が見つかりました！開発チームに感謝！'
      )
      return # ここで処理を終了
    end

    # すでに評価済み、または基本スコアが0の場合は処理しない
    return if @word.ai_score.present? || @word.score.zero?

    prompt = <<~PROMPT
      # 概要
      あなたは、しりとりゲームの単語を評価するAIです。
      単語「#{@word.body}」を分析し、以下の2つを生成してください。

      1.  **評価点:** -10点から10点の間（整数）で評価します。独創性、ユーモア、専門性などを基準とします。
      2.  **評価理由:** 点数の理由について面白くて納得できる詳細な説明を「ですます調」で記述してください。

      評価理由において、最終的なスコア自体は絶対に表記しないでください。(例:〇〇点と評価しました)

      # 出力形式
      「評価点: [点数]」「理由: [評価理由]」の形式を必ず守ってください。
    PROMPT

    begin
      response_text = GeminiCraft.generate_content(prompt)

      base_score = response_text.match(/評価点:\s*(-?\d+)/)&.captures&.first&.to_i
      comment = response_text.match(/理由:\s*(.+)/m)&.captures&.first

      if base_score && comment
        word_jitter = (@word.body.bytes.sum % 1999) - 999

        final_score = (base_score * 1000) + word_jitter

        @word.update!(ai_score: final_score, ai_evaluation_comment: comment)
      end
    rescue StandardError => e
      Rails.logger.error "AI評価中にエラーが発生しました。単語: '#{@word.body}', エラー: #{e.message}"
    end
  end
end
