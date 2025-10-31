class AddChainBonusToWords < ActiveRecord::Migration[7.1]
  def change
    add_column :words, :chain_bonus_score, :integer
    add_column :words, :chain_bonus_comment, :text
  end
end
