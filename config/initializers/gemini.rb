require 'gemini_craft'

GeminiCraft.configure do |config|
  config.api_key = ENV["GEMINI_API_KEY"].presence || Rails.application.credentials.dig(:google, :gemini_api_key)
  config.logger = Rails.logger
end
