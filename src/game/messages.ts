const MESSAGES: Record<string, string> = {
  invalid_name: "Pick a name between 1 and 16 characters.",
  name_taken: "That name is already on this frequency. Pick another.",
  invalid_code: "Room codes are 4 letters or numbers. Check the code and try again.",
  room_not_found: "No room answered on that frequency. Check the code.",
  room_full: "This room is full. It takes 8 players.",
  room_unavailable: "The room could not be opened. Try again in a moment.",
  game_started: "That game is already underway. Ask the host for a new room.",
  game_in_progress: "You can only leave before the game starts or after it ends.",
  not_host: "Only the host can do that.",
  not_enough_players: "A room needs at least 2 players.",
  not_beacon: "Only this round's Beacon can send the clue.",
  beacon_cannot_guess: "The Beacon already knows the target. Wait for the room to guess.",
  clue_empty: "Send the room a clue first.",
  clue_too_long: "Keep the clue short. Five words, sixty characters.",
  clue_word_limit: "The clue can be at most 5 words.",
  clue_has_number: "No numbers in a clue. Words only.",
  clue_uses_pole: "That clue uses a word from the spectrum. Find another way in.",
  invalid_guess: "Choose a frequency between 0 and 100.",
  already_locked: "Your frequency is already locked in.",
  phase_closed: "That part of the round just ended.",
  not_in_room: "Your seat in this room has expired.",
  service_unavailable: "The room's signal dropped. Try again in a moment.",
  network: "No signal. Check your connection; the room will keep trying.",
  invalid_response: "The room sent back something unreadable. Try again.",
  busy: "The room is busy. Give it a second.",
  invalid_request: "Something in that request was missing. Try again.",
  unknown_action: "The room did not understand that move.",
  not_found: "The room's endpoint was not found.",
  method_not_allowed: "That request method is not supported.",
};

export function messageFor(code: string): string {
  if (MESSAGES[code]) return MESSAGES[code];
  if (code.startsWith("http_")) return "The room could not be reached. Try reloading.";
  return "Something went sideways. Try again.";
}

export function isSessionLost(code: string): boolean {
  return code === "room_not_found" || code === "not_in_room";
}
