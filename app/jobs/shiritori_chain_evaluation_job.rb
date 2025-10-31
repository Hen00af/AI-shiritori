class ShiritoriChainEvaluationJob < ApplicationJob
  queue_as :default

  def perform(current_word, previous_word)
    # AIによる連鎖評価を実行
    ShiritoriChainEvaluationService.new(current_word, previous_word).evaluate_and_save

    # broadcast_resultsメソッドは削除し、新しいサービスクラスを呼び出す
    ResultBroadcasterService.call(current_word.room)
  end
end
