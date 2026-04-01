class ShiritoriChainEvaluationService
  FALLBACK_COMMENTS_HIGH = [
    "この連鎖は見事です！二つの言葉の間に意外なテーマ性を感じます。物語が生まれています。",
    "前の言葉から自然に流れるような素晴らしい連鎖です。センスある選択に脱帽です。",
    "この流れは秀逸！言葉と言葉の間に見えない橋が架かっているようです。",
    "テーマが一貫していて素晴らしい連鎖です。意図的な選択なら、相当なしりとり上級者です。",
  ].freeze

  FALLBACK_COMMENTS_MID = [
    "自然な流れの連鎖です。特別な意外性はありませんが、安定した展開です。",
    "この連鎖は無難ですが、着実に前進できています。次はもっと大胆に行きましょう。",
    "普通の連鎖ですが、しっかりとルールを守った選択です。",
  ].freeze

  FALLBACK_COMMENTS_LOW = [
    "前の言葉との関連性が薄い連鎖でした。テーマを意識すると連鎖ボーナスが狙えます。",
    "唐突な方向転換ですね。もう少し前の言葉を意識した選択だと高評価が得られます。",
  ].freeze

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
      else
        apply_fallback_score
      end
    rescue StandardError => e
      Rails.logger.error "AI連鎖評価中にエラーが発生しました。単語: '#{@current_word.body}', エラー: #{e.message}"
      apply_fallback_score
    end
  end

  private

  def apply_fallback_score
    combined = @previous_word.body + @current_word.body
    bytes_sum = combined.bytes.sum
    combined_length = combined.length

    length_score = [[combined_length - 6, -5].max, 7].min
    byte_mod = (bytes_sum % 7) - 3
    base_score = [[length_score + byte_mod, -10].max, 10].min

    comment = if base_score >= 5
      FALLBACK_COMMENTS_HIGH[bytes_sum % FALLBACK_COMMENTS_HIGH.length]
    elsif base_score >= 0
      FALLBACK_COMMENTS_MID[bytes_sum % FALLBACK_COMMENTS_MID.length]
    else
      FALLBACK_COMMENTS_LOW[bytes_sum % FALLBACK_COMMENTS_LOW.length]
    end

    word_jitter = (bytes_sum % 999) - 499
    final_score = (base_score * 500) + word_jitter

    @current_word.update!(chain_bonus_score: final_score, chain_bonus_comment: comment)
  end
end
