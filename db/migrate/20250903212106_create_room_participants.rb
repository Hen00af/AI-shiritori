class CreateRoomParticipants < ActiveRecord::Migration[7.0]
  def change
    create_table :room_participants do |t|
      t.references :room, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.timestamps
    end
    add_index :room_participants, %i[room_id user_id], unique: true
  end
end
