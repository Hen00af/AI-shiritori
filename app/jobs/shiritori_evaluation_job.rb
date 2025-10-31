class ShiritoriEvaluationJob < ApplicationJob
  queue_as :default

  def perform(word)
    # AIによる単語評価を実行
    ShiritoriEvaluationService.new(word).evaluate_and_save

    # broadcast_resultsメソッドは削除し、新しいサービスクラスを呼び出す
    ResultBroadcasterService.call(word.room)
  end
end
