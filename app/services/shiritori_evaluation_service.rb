class ShiritoriEvaluationService
  FALLBACK_COMMENTS_HIGH = [
    "その語彙力、脱帽です。専門家しか知らないような言葉を自在に操るとは、恐れ入ります。",
    "独創的かつユーモラスな一手！場の空気を一変させる選択です。センスが光ります。",
    "知識の深さが伝わってくる素晴らしい単語です。この連鎖はお見事でした。",
    "予想外の角度から攻めてきましたね。こういう意外性こそがしりとりの醍醐味です。",
    "文化的背景を踏まえた選択が素晴らしいです。見識の広さに感動しました。",
  ].freeze

  FALLBACK_COMMENTS_MID = [
    "オーソドックスながらも確実な選択です。基礎を大切にする姿勢が伝わります。",
    "リズム感のある言葉で、会話の流れをうまく保てています。堅実な一手です。",
    "よく使われる単語ですが、このタイミングでの選択は的確です。",
    "シンプルイズベスト。迷わず選べるこの言葉は、ある意味で強みです。",
  ].freeze

  FALLBACK_COMMENTS_LOW = [
    "もう少し個性的な単語に挑戦してみると、より高得点が狙えるかもしれません。",
    "一般的すぎる選択でした。次回はもっと珍しい語彙に挑戦してみてください。",
    "無難な一手ですが、しりとりの醍醐味はもっと奥深いところにあります。",
  ].freeze

  def initialize(word)
    @word = word
  end

  def evaluate_and_save
    if @word.body == 'そにっくがーでん'
      @word.update!(
        ai_score: 2_000_000_000,
        ai_evaluation_comment: '秘密の言葉が見つかりました！開発チームに感謝！'
      )
      return
    end

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
      else
        apply_fallback_score
      end
    rescue StandardError => e
      Rails.logger.error "AI評価中にエラーが発生しました。単語: '#{@word.body}', エラー: #{e.message}"
      apply_fallback_score
    end
  end

  private

  def apply_fallback_score
    bytes_sum = @word.body.bytes.sum
    length = @word.body.length

    length_score = [[length - 3, -5].max, 7].min
    byte_mod = (bytes_sum % 7) - 3
    base_score = [[length_score + byte_mod, -10].max, 10].min

    comment = if base_score >= 5
      FALLBACK_COMMENTS_HIGH[bytes_sum % FALLBACK_COMMENTS_HIGH.length]
    elsif base_score >= 0
      FALLBACK_COMMENTS_MID[bytes_sum % FALLBACK_COMMENTS_MID.length]
    else
      FALLBACK_COMMENTS_LOW[bytes_sum % FALLBACK_COMMENTS_LOW.length]
    end

    word_jitter = (bytes_sum % 1999) - 999
    final_score = (base_score * 1000) + word_jitter

    @word.update!(ai_score: final_score, ai_evaluation_comment: comment)
  end
end
