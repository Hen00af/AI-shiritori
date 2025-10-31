Rails.application.routes.draw do
  # Action Cableサーバーをマウントする
  mount ActionCable.server => '/cable'

  devise_for :users

  # 認証済みユーザーのルートパス
  authenticated :user do
    root to: 'rooms#index', as: :authenticated_root
  end

  devise_scope :user do
    unauthenticated do
      root to: 'devise/sessions#new', as: :unauthenticated_root
    end
  end

  resources :rooms, only: %i[index show new edit create update destroy] do
    collection do
      post :solo # ソロモード作成
      get :solo_ranking # ソロスコアランキング
      get :solo_ranking_json # ソロスコアランキングAPI（画面遷移なし用）
    end

    member do
      get :status      # ステータス確認用
      delete :leave    # 退出用（既存）
      post :join       # 参加用（既存）
      get :result      # 結果表示用（既存）
    end
  end

  resources :words, only: [:create]

  # デプロイ時に必須（消さないでね）
  get 'up' => 'rails/health#show'
end
