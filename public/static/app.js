// =====================================================================
// SHELTER — клиентское мультиплеерное приложение (комнаты, реальные игроки)
// =====================================================================

(function () {
  'use strict';

  const SESSION_KEY = 'bunker_mp_session_v1';
  const DEFAULT_NAME_KEY = 'bunker_default_name_v1';
  const LANG_KEY = 'shelter_lang_v1';
  const SOUND_KEY = 'shelter_sound_v1';
  const SEEN_HOWTO_KEY = 'shelter_seen_howto_v1';
  const POLL_INTERVAL = 2500;
  const API_BASE = '/api/room';

  const TELEGRAM_CHANNEL_URL = 'https://t.me/Prosto_Progers';

  // ---------------------------------------------------------------------
  // I18N — словарь перевода интерфейса (RU / EN)
  // Примечание: игровой контент, генерируемый сервером (профессии,
  // катастрофы, параметры бункера, ситуации, сообщения чата, имена
  // игроков) хранится в базе данных только на русском языке и не
  // переводится — переключатель влияет только на элементы интерфейса
  // (кнопки, подписи, правила, подсказки, модалки, тосты).
  // ---------------------------------------------------------------------

  const I18N = {
    ru: {
      // Ошибки API
      err_room_not_found: 'Комната не найдена. Проверьте код.',
      err_slot_not_found: 'Такого места не существует.',
      err_slot_taken: 'Это место уже занято другим игроком.',
      err_only_host: 'Это действие доступно только хосту комнаты.',
      err_only_host_can_start: 'Начать игру может только хост.',
      err_not_enough_players: 'Нужно минимум 2 занятых места, чтобы начать игру.',
      err_bad_field: 'Некорректное поле характеристики.',
      err_not_joined: 'Вы ещё не заняли место в этой комнате.',
      err_already_revealed: 'Нельзя перебросить уже раскрытую характеристику.',
      err_voting_locked: 'Голосование ещё не открыто.',
      err_vote_already_active: 'Голосование уже идёт.',
      err_no_active_vote: 'Сейчас нет активного голосования.',
      err_vote_expired: 'Время голосования истекло.',
      err_target_not_found: 'Выбранный игрок не найден.',
      err_excluded_cannot_vote: 'Исключённые игроки не могут голосовать.',
      err_empty_message: 'Сообщение не может быть пустым.',
      err_only_host_or_expired: 'Завершить голосование раньше времени может только хост.',
      err_player_not_found: 'Игрок не найден.',
      err_cannot_vote_self: 'Нельзя голосовать за самого себя.',
      err_game_ended: 'Игра уже завершена — начните новую игру.',
      err_not_enough_alive_for_vote: 'Нужно минимум 3 живых игрока, чтобы начать голосование.',
      err_generic: 'Что-то пошло не так. Попробуйте ещё раз.',

      // Характеристики персонажа
      attr_ageGender: 'Возраст / пол',
      attr_health: 'Здоровье',
      attr_hobby: 'Хобби',
      attr_phobia: 'Фобия',
      attr_traitPositive: 'Черта характера (+)',
      attr_traitNegative: 'Черта характера (−)',
      attr_inventory: 'Инвентарь',
      attr_extraInfo: 'Доп. информация',

      // Общее
      footer_copyright: '© SHELTER — сетевая игра на выживание',
      footer_copyright_board: '© SHELTER — сетевая настольная игра на выживание',
      btn_back: 'Назад',
      btn_cancel: 'Отмена',
      btn_understood: 'Понятно',
      toast_error_title: 'Ошибка',
      lang_switch_title: 'Переключить язык интерфейса',
      sound_switch_title_on: 'Звук включён — выключить',
      sound_switch_title_off: 'Звук выключен — включить',

      // Подсказка на игровом экране (онбординг)
      game_hint_text: '<strong>Как играть:</strong> раскрывайте свои характеристики (по одной за раунд) и убеждайте остальных вслух, почему вас стоит оставить. С 3-го раунда хост открывает голосование — минимум мест, выживает больше, чем вместимость бункера позволяет.',
      game_hint_close_title: 'Скрыть подсказку',

      // Лендинг
      landing_subtitle: 'сетевая игра на выживание — каждый со своего устройства',
      landing_badge_players: '4–16 игроков',
      landing_badge_devices: 'Свой телефон или ПК',
      landing_badge_fast: 'Старт за минуту',
      btn_play: 'Играть',
      btn_howto: 'Как начать игру',
      btn_settings: 'Настройки',
      btn_telegram: 'Наш Telegram-канал',

      // Правила игры (полный блок)
      rules_modal_title: 'Правила игры «Shelter»',
      rules_title_plain: 'Правила игры',
      rule1_h: 'Катастрофа и бункер',
      rule1_t: 'Хост объявляет катастрофу, уничтожившую мир на поверхности, и параметры бункера. Мест на всех не хватит.',
      rule2_h: 'Секретное досье — только для тебя',
      rule2_t: 'Каждый получает карточку: профессия видна сразу, а возраст, здоровье, фобия, хобби, черты характера, инвентарь — видны только тебе, пока ты сам их не раскроешь.',
      rule3_h: 'Раунды и раскрытие',
      rule3_t: 'В каждом раунде игроки по очереди раскрывают характеристики и рассказывают о себе вслух, чтобы убедить остальных оставить их в бункере.',
      rule4_h: 'Ситуации',
      rule4_t: 'Хост периодически озвучивает случайные ситуации в бункере — их нужно обсудить в чате или вслух и принять решение сообща.',
      rule5_h: 'Голосование с таймером',
      rule5_t: 'Начиная с 3-го раунда открывается голосование на время: все решают, кто покинет бункер. Исключённый выбывает из игры.',
      rule6_h: 'Победа',
      rule6_t: 'Вместимость бункера всегда меньше числа выживших — это видно на экране катастрофы. Игра продолжается, пока не останется ровно столько игроков, сколько мест — они автоматически побеждают.',

      // «Как начать игру»
      stamp_secret: 'Секретно',
      howto_modal_title: 'Как начать игру',
      howto1_h: 'Создайте комнату',
      howto1_t: 'Вы создаёте комнату и получаете короткий код.',
      howto2_h: 'Позовите игроков',
      howto2_t: 'Передайте код остальным — каждый заходит на этот же сайт со своего устройства.',
      howto3_h: 'Займите место',
      howto3_t: 'Каждый выбирает своё место в лобби и вписывает имя.',
      howto4_h: 'Хост управляет игрой',
      howto4_t: 'Первый занявший место становится хостом и запускает катастрофу.',
      howto5_h: 'Ваша тайна — только ваша',
      howto5_t: 'Свои характеристики видите только вы — другим они не видны, пока вы сами их не раскроете.',
      howto6_h: 'Выживайте',
      howto6_t: 'Раскрывайте характеристики в свою пользу, убеждайте остальных — с 3-го раунда начинается голосование на исключение. Полные правила — в разделе «Настройки».',

      // Страница «Играть»
      play_title: 'ИГРАТЬ',
      play_subtitle: 'создайте комнату или войдите в существующую',
      divider_or: 'или',

      create_title: 'Создать комнату',
      create_count_label: 'Количество мест в игре:',
      create_count_hint: 'Каждый реальный игрок сам займёт своё место в лобби со своего устройства — по коду комнаты.',
      create_howitworks_label: 'Как это работает',
      create_howitworks_html:
        '1. Вы создаёте комнату и получаете короткий код.<br/>' +
        '2. Передайте код остальным игрокам — каждый заходит на этот же сайт и вводит код.<br/>' +
        '3. Каждый выбирает своё место и вписывает имя — так определяется, кто есть кто.<br/>' +
        '4. Первый занявший место становится хостом и управляет ходом игры.<br/>' +
        '5. В начале игры только вы видите свои характеристики — другим они не видны, пока вы сами их не раскроете.',
      create_btn: 'Создать комнату',
      create_btn_loading: 'Создание...',

      join_title: 'Войти по коду',
      join_code_label: 'Код комнаты',
      join_code_hint: 'Получите код у того, кто создал комнату, и введите его здесь, чтобы выбрать своё место.',
      join_btn: 'Войти',
      toast_invalid_code_title: 'Некорректный код',
      toast_invalid_code_msg: 'Код комнаты состоит из 5 символов.',

      // Настройки
      settings_title: 'НАСТРОЙКИ',
      settings_default_name_title: 'Имя по умолчанию',
      settings_default_name_hint: 'Это имя будет автоматически предложено, когда вы занимаете место в новой комнате. Можно изменить его в любой момент перед подтверждением.',
      settings_name_placeholder: 'Например, Алекс',
      settings_save_btn: 'Сохранить',
      settings_rules_title: 'Правила игры',
      settings_about_title: 'О проекте',
      settings_about_p1: '«SHELTER» — бесплатная сетевая игра-ролевая дискуссия о выживших в укрытии после катастрофы. Проект создан независимыми разработчиками и не связан с правообладателями каких-либо коммерческих настольных игр.',
      settings_about_p2: 'Каждый игрок заходит со своего устройства по коду комнаты — сервер хранит характеристики персонажей приватно и раскрывает их только по решению самого игрока.',
      settings_about_p3: 'Проект развивается силами энтузиастов. Если он вам нравится — подпишитесь на наш Telegram-канал, там мы рассказываем о новых возможностях и обновлениях.',
      toast_saved_title: 'Сохранено',
      toast_saved_name: 'Имя по умолчанию: {name}.',
      toast_saved_cleared: 'Имя по умолчанию очищено.',

      // Выбор места
      seat_connecting: 'Подключение к комнате {code}...',
      room_title: 'КОМНАТА',
      seat_choose_subtitle: 'выбери своё место',
      seat_occupied: '{claimed} / {total} занято',
      seat_game_started_msg: 'Игра в этой комнате уже началась. Дождитесь новой игры или попросите хоста нажать «Новая игра».',
      seat_slot_label: 'Место №{slot}',
      seat_name_placeholder: 'Твоё имя',
      seat_confirm_btn: 'Занять место',
      seat_leave_btn: 'Выйти в главное меню',
      seat_claiming_btn: 'Занимаем...',
      toast_enter_name_title: 'Введите имя',
      toast_enter_name_msg: 'Пожалуйста, впишите своё имя перед тем, как занять место.',
      toast_welcome_title: 'Добро пожаловать!',
      toast_welcome_msg: 'Вы заняли место №{slot} как {name}.',
      toast_seat_fail_title: 'Не удалось занять место',

      seat_free: 'Свободно',
      seat_me_badge: 'Ты',
      seat_host_title: 'Хост',
      seat_excluded_title: 'Исключён',

      room_code_label: 'Код комнаты:',
      copy_code_title: 'Скопировать ссылку-приглашение',
      toast_copied_title: 'Скопировано',
      toast_copied_msg: 'Ссылка-приглашение скопирована в буфер обмена.',
      toast_room_code_title: 'Код комнаты',

      // Лобби
      toast_room_gone_title: 'Комната не найдена',
      toast_room_gone_msg: 'Возможно, комната была удалена или код неверен.',
      lobby_title: 'ЛОББИ',
      lobby_subtitle: 'знакомство перед спуском',
      lobby_players_divider: '{claimed} / {total} игроков в комнате',
      lobby_bunker_slots_title: 'Отсеки бункера — кто уже внутри',
      lobby_start_btn: 'Начать катастрофу',
      lobby_min_players_hint: 'Нужно минимум 2 занятых места, чтобы начать игру.',
      lobby_waiting_host: 'Ожидаем, пока хост{host} начнёт игру...',
      lobby_leave_btn: 'Покинуть комнату',
      lobby_starting_btn: 'Генерация катастрофы...',

      // Катастрофа
      catastrophe_alert: 'Внимание — глобальная катастрофа',
      label_size: 'Площадь',
      label_duration: 'Срок пребывания',
      label_floors: 'Этажность',
      label_extra_room: 'Доп. помещение',
      label_food: 'Запасы провизии',
      label_capacity: 'Вместимость бункера',
      capacity_person_suffix: '{n} чел.',
      capacity_hint: 'В бункер спустится больше людей, чем в нём есть мест! Побеждают те, кто останется, когда выживших станет ровно {capacity}.',
      btn_reroll_catastrophe: 'Другая катастрофа',
      btn_reroll_bunker: 'Другой бункер',
      btn_enter_bunker: 'Спуститься в бункер',
      catastrophe_waiting_host: 'Хост изучает катастрофу — скоро все спустятся в бункер...',

      // Игровой экран
      game_round: 'Раунд {round}',
      btn_situation: 'Ситуация',
      btn_next_round: 'Следующий раунд',
      btn_new_game: 'Новая игра',
      title_rules_hint: 'Правила игры',
      survivors_label: 'Выживших в бункере: {alive} / {total}',
      target_suffix: ' (цель — {capacity})',
      voting_available: 'Голосование доступно',
      voting_opens_in: 'Голосование откроется в раунде {round}',
      mini_catastrophe: 'Катастрофа',
      mini_bunker: 'Бункер',
      mini_duration: 'Срок',
      mini_food: 'Провизия',
      mini_capacity: 'Вместимость',

      // Победа
      victory_alert: 'Бункер укомплектован — игра окончена',
      victory_title: 'Победители заняли бункер!',
      victory_desc_capacity: 'В бункере было {capacity} мест — именно столько выживших и остались внутри.',
      victory_desc_no_capacity: 'В бункере закончились свободные места.',
      victory_no_winners: 'Победители не определены.',
      victory_surface_title: 'Остались на поверхности',
      victory_waiting_host: 'Хост скоро начнёт новую игру...',
      btn_leave_menu: 'Выйти в главное меню',

      // Карточка игрока
      player_profession_label: 'Профессия',
      exclude_toggle_title: 'Исключить/вернуть',
      vote_own: 'Твой голос',
      vote_against: 'Голосовать против',
      vote_change: 'Изменить голос',
      reroll_title: 'Перебросить, пока скрыто от других',
      voted_for_badge: 'Голосует за меня',
      votes_received: '{count} голос.',
      card_flip_hint: 'Нажмите, чтобы посмотреть досье',
      card_flip_back_title: 'Свернуть карточку',
      card_revealed_count: 'Раскрыто {revealed} из {total} характеристик',
      card_you_label: 'ТЫ',
      card_excluded_label: 'ИСКЛЮЧЁН',

      // Голосование
      voting_round_title: 'Голосование — раунд {round}',
      votes_cast: 'Голосов подано: {cast} / {total}',
      voting_progress_label: 'Проголосовали',
      voting_waiting_for: 'Ждём голос: {names}',
      voting_all_voted: 'Все проголосовали!',
      voting_leader_note: 'Сейчас лидирует: {name} ({votes} голос.)',
      voting_leader_tie_note: 'Пока ничья между несколькими игроками',
      voting_no_votes_note: 'Пока никто не проголосовал',
      finalize_btn: 'Завершить голосование',
      finalize_disabled_title: 'Завершить раньше времени может только хост',
      cancel_vote_btn: 'Отменить голосование',
      cancel_vote_confirm_title: 'Отменить голосование?',
      cancel_vote_confirm_desc: 'Все текущие голоса будут аннулированы. Это действие нельзя отменить.',
      voting_result_title: 'Итоги голосования (раунд {round})',
      voting_result_none: 'Никто не был исключён.',
      voting_result_excluded: 'Исключён(а): {name} ({votes} голос.)',
      voting_result_tie: 'Ничья — никто не исключён.',
      voting_new_vote_btn: 'Новое голосование',
      voting_locked_hint: 'Голосование откроется начиная с {threshold}-го раунда. Сейчас раунд {round}.',
      voting_locked_players_hint: 'Нужно минимум 3 живых игрока для голосования.',
      voting_title: 'Голосование',
      voting_host_hint: 'Запустите голосование за исключение — у всех будет ограниченное время на голос.',
      voting_start_btn: 'Начать голосование',
      voting_seconds_suffix: 'сек.',
      voting_available_hint: 'Голосование доступно — хост может его запустить в любой момент.',
      voting_you_voted_hint: 'Ты уже проголосовал(а). Нажми на другого игрока, чтобы изменить голос.',
      voting_vote_now_hint: 'Выбери игрока в списке справа или на его карточке, чтобы отдать голос.',

      // Чат
      chat_title: 'Чат бункера',
      discussion_timer_btn: 'Таймер обсуждения',
      chat_input_placeholder: 'Написать сообщение...',
      default_player_name: 'Игрок',

      // Сброс игры
      reset_confirm_title: 'Начать новую игру?',
      reset_confirm_desc: 'Текущий прогресс (раунды, раскрытые характеристики, исключённые игроки) будет удалён для всех игроков комнаты. Все останутся на своих местах.',
      btn_confirm_reset: 'Да, начать заново',

      // Модалки событий/ситуаций
      event_modal_title: 'Событие раунда {round}',
      situation_discuss_hint: 'Озвучьте эту ситуацию вслух всем участникам и обсудите в чате, как бункер будет действовать.',
      situation_close_btn: 'Обсудили',
    },

    en: {
      err_room_not_found: 'Room not found. Check the code.',
      err_slot_not_found: 'This seat does not exist.',
      err_slot_taken: 'This seat is already taken by another player.',
      err_only_host: 'Only the room host can do this.',
      err_only_host_can_start: 'Only the host can start the game.',
      err_not_enough_players: 'At least 2 seats must be taken to start the game.',
      err_bad_field: 'Invalid attribute field.',
      err_not_joined: "You haven't taken a seat in this room yet.",
      err_already_revealed: 'You cannot reroll an already revealed attribute.',
      err_voting_locked: 'Voting is not open yet.',
      err_vote_already_active: 'A vote is already in progress.',
      err_no_active_vote: 'There is no active vote right now.',
      err_vote_expired: 'Voting time has expired.',
      err_target_not_found: 'Selected player not found.',
      err_excluded_cannot_vote: 'Excluded players cannot vote.',
      err_empty_message: 'Message cannot be empty.',
      err_only_host_or_expired: 'Only the host can end the vote early.',
      err_player_not_found: 'Player not found.',
      err_cannot_vote_self: 'You cannot vote for yourself.',
      err_game_ended: 'The game has already ended — start a new game.',
      err_not_enough_alive_for_vote: 'At least 3 alive players are needed to start a vote.',
      err_generic: 'Something went wrong. Please try again.',

      attr_ageGender: 'Age / gender',
      attr_health: 'Health',
      attr_hobby: 'Hobby',
      attr_phobia: 'Phobia',
      attr_traitPositive: 'Personality trait (+)',
      attr_traitNegative: 'Personality trait (−)',
      attr_inventory: 'Inventory',
      attr_extraInfo: 'Extra info',

      footer_copyright: '© SHELTER — an online survival game',
      footer_copyright_board: '© SHELTER — an online survival board game',
      btn_back: 'Back',
      btn_cancel: 'Cancel',
      btn_understood: 'Got it',
      toast_error_title: 'Error',
      lang_switch_title: 'Switch interface language',
      sound_switch_title_on: 'Sound on — mute',
      sound_switch_title_off: 'Sound off — unmute',

      game_hint_text: '<strong>How to play:</strong> reveal your attributes one at a time each round and convince everyone out loud why you should stay. Starting from round 3, the host opens a vote — fewer seats exist than survivors, so the bunker capacity decides who wins.',
      game_hint_close_title: 'Hide this hint',

      landing_subtitle: 'an online survival game — everyone joins from their own device',
      landing_badge_players: '4–16 players',
      landing_badge_devices: 'Any phone or PC',
      landing_badge_fast: 'Start in a minute',
      btn_play: 'Play',
      btn_howto: 'How to start',
      btn_settings: 'Settings',
      btn_telegram: 'Our Telegram channel',

      rules_modal_title: 'Rules of «Shelter»',
      rules_title_plain: 'Game rules',
      rule1_h: 'Catastrophe and the bunker',
      rule1_t: 'The host announces the catastrophe that destroyed the surface world, and the bunker parameters. There won\u2019t be enough room for everyone.',
      rule2_h: 'Secret dossier — for your eyes only',
      rule2_t: 'Everyone gets a card: profession is visible right away, while age, health, phobia, hobby, personality traits and inventory are visible only to you until you reveal them yourself.',
      rule3_h: 'Rounds and reveals',
      rule3_t: 'Each round, players take turns revealing attributes and talking about themselves out loud to convince the others to keep them in the bunker.',
      rule4_h: 'Situations',
      rule4_t: 'The host periodically announces random situations inside the bunker — discuss them in chat or out loud and decide together.',
      rule5_h: 'Timed voting',
      rule5_t: 'Starting from round 3, a timed vote opens: everyone decides who leaves the bunker. The excluded player is out of the game.',
      rule6_h: 'Victory',
      rule6_t: 'The bunker capacity is always lower than the number of survivors — you can see it on the catastrophe screen. The game continues until exactly as many players remain as there are seats — they automatically win.',

      stamp_secret: 'Classified',
      howto_modal_title: 'How to start the game',
      howto1_h: 'Create a room',
      howto1_t: 'You create a room and get a short code.',
      howto2_h: 'Invite players',
      howto2_t: 'Share the code with everyone else — each player opens the same site on their own device.',
      howto3_h: 'Take a seat',
      howto3_t: 'Everyone picks their own seat in the lobby and enters their name.',
      howto4_h: 'The host runs the game',
      howto4_t: 'Whoever claims a seat first becomes the host and starts the catastrophe.',
      howto5_h: 'Your secret stays yours',
      howto5_t: 'Only you can see your own attributes — others can\u2019t see them until you reveal them yourself.',
      howto6_h: 'Survive',
      howto6_t: 'Reveal attributes to your advantage and convince the others — starting from round 3, an exclusion vote begins. Full rules are in the "Settings" section.',

      play_title: 'PLAY',
      play_subtitle: 'create a room or join an existing one',
      divider_or: 'or',

      create_title: 'Create a room',
      create_count_label: 'Number of seats:',
      create_count_hint: 'Each real player claims their own seat in the lobby from their own device — using the room code.',
      create_howitworks_label: 'How it works',
      create_howitworks_html:
        '1. You create a room and get a short code.<br/>' +
        '2. Share the code with the other players — everyone opens the same site and enters the code.<br/>' +
        '3. Everyone picks a seat and enters their name — that\u2019s how you know who is who.<br/>' +
        '4. Whoever claims a seat first becomes the host and controls the game.<br/>' +
        '5. At the start, only you see your own attributes — others can\u2019t see them until you reveal them yourself.',
      create_btn: 'Create room',
      create_btn_loading: 'Creating...',

      join_title: 'Join with a code',
      join_code_label: 'Room code',
      join_code_hint: 'Get the code from whoever created the room, and enter it here to pick your seat.',
      join_btn: 'Join',
      toast_invalid_code_title: 'Invalid code',
      toast_invalid_code_msg: 'A room code is 5 characters long.',

      settings_title: 'SETTINGS',
      settings_default_name_title: 'Default name',
      settings_default_name_hint: 'This name will be pre-filled automatically when you take a seat in a new room. You can change it any time before confirming.',
      settings_name_placeholder: 'e.g. Alex',
      settings_save_btn: 'Save',
      settings_rules_title: 'Game rules',
      settings_about_title: 'About the project',
      settings_about_p1: '«SHELTER» is a free online role-play discussion game about survivors sheltering after a catastrophe. The project is made by independent developers and is not affiliated with the rights holders of any commercial board game.',
      settings_about_p2: 'Each player joins from their own device using a room code — the server keeps character attributes private and reveals them only when the player themselves decides to.',
      settings_about_p3: 'The project is developed by enthusiasts. If you like it — subscribe to our Telegram channel, where we share news about new features and updates.',
      toast_saved_title: 'Saved',
      toast_saved_name: 'Default name: {name}.',
      toast_saved_cleared: 'Default name cleared.',

      seat_connecting: 'Connecting to room {code}...',
      room_title: 'ROOM',
      seat_choose_subtitle: 'choose your seat',
      seat_occupied: '{claimed} / {total} taken',
      seat_game_started_msg: 'The game in this room has already started. Wait for a new game or ask the host to press "New game".',
      seat_slot_label: 'Seat #{slot}',
      seat_name_placeholder: 'Your name',
      seat_confirm_btn: 'Take seat',
      seat_leave_btn: 'Back to main menu',
      seat_claiming_btn: 'Taking seat...',
      toast_enter_name_title: 'Enter your name',
      toast_enter_name_msg: 'Please enter your name before taking a seat.',
      toast_welcome_title: 'Welcome!',
      toast_welcome_msg: 'You took seat #{slot} as {name}.',
      toast_seat_fail_title: 'Could not take seat',

      seat_free: 'Free',
      seat_me_badge: 'You',
      seat_host_title: 'Host',
      seat_excluded_title: 'Excluded',

      room_code_label: 'Room code:',
      copy_code_title: 'Copy invite link',
      toast_copied_title: 'Copied',
      toast_copied_msg: 'Invite link copied to clipboard.',
      toast_room_code_title: 'Room code',

      toast_room_gone_title: 'Room not found',
      toast_room_gone_msg: 'The room may have been deleted, or the code is incorrect.',
      lobby_title: 'LOBBY',
      lobby_subtitle: 'getting to know each other before descending',
      lobby_players_divider: '{claimed} / {total} players in the room',
      lobby_bunker_slots_title: 'Bunker bays — who\u2019s already inside',
      lobby_start_btn: 'Start the catastrophe',
      lobby_min_players_hint: 'At least 2 seats must be taken to start the game.',
      lobby_waiting_host: 'Waiting for the host{host} to start the game...',
      lobby_leave_btn: 'Leave room',
      lobby_starting_btn: 'Generating catastrophe...',

      catastrophe_alert: 'Warning — global catastrophe',
      label_size: 'Area',
      label_duration: 'Stay duration',
      label_floors: 'Floors',
      label_extra_room: 'Extra room',
      label_food: 'Food supplies',
      label_capacity: 'Bunker capacity',
      capacity_person_suffix: '{n} people',
      capacity_hint: 'More people will descend into the bunker than there are seats! Whoever remains when exactly {capacity} survivors are left, wins.',
      btn_reroll_catastrophe: 'Reroll catastrophe',
      btn_reroll_bunker: 'Reroll bunker',
      btn_enter_bunker: 'Descend into the bunker',
      catastrophe_waiting_host: 'The host is reviewing the catastrophe — everyone will descend into the bunker soon...',

      game_round: 'Round {round}',
      btn_situation: 'Situation',
      btn_next_round: 'Next round',
      btn_new_game: 'New game',
      title_rules_hint: 'Game rules',
      survivors_label: 'Survivors in the bunker: {alive} / {total}',
      target_suffix: ' (target — {capacity})',
      voting_available: 'Voting available',
      voting_opens_in: 'Voting opens in round {round}',
      mini_catastrophe: 'Catastrophe',
      mini_bunker: 'Bunker',
      mini_duration: 'Duration',
      mini_food: 'Food',
      mini_capacity: 'Capacity',

      victory_alert: 'Bunker is full — game over',
      victory_title: 'The winners have taken the bunker!',
      victory_desc_capacity: 'The bunker had {capacity} seats — exactly that many survivors remained inside.',
      victory_desc_no_capacity: 'The bunker ran out of free seats.',
      victory_no_winners: 'No winners determined.',
      victory_surface_title: 'Remained on the surface',
      victory_waiting_host: 'The host will start a new game soon...',
      btn_leave_menu: 'Back to main menu',

      player_profession_label: 'Profession',
      exclude_toggle_title: 'Exclude / restore',
      vote_own: 'Your vote',
      vote_against: 'Vote against',
      vote_change: 'Change vote',
      reroll_title: 'Reroll while hidden from others',
      voted_for_badge: 'Voting for me',
      votes_received: '{count} votes',
      card_flip_hint: 'Tap to see the dossier',
      card_flip_back_title: 'Flip card back',
      card_revealed_count: '{revealed} of {total} attributes revealed',
      card_you_label: 'YOU',
      card_excluded_label: 'EXCLUDED',

      voting_round_title: 'Voting — round {round}',
      votes_cast: 'Votes cast: {cast} / {total}',
      voting_progress_label: 'Voted',
      voting_waiting_for: 'Waiting for: {names}',
      voting_all_voted: 'Everyone has voted!',
      voting_leader_note: 'Currently leading: {name} ({votes} votes)',
      voting_leader_tie_note: 'Currently tied between several players',
      voting_no_votes_note: 'No votes cast yet',
      finalize_btn: 'End voting',
      finalize_disabled_title: 'Only the host can end the vote early',
      cancel_vote_btn: 'Cancel voting',
      cancel_vote_confirm_title: 'Cancel this vote?',
      cancel_vote_confirm_desc: 'All votes cast so far will be discarded. This cannot be undone.',
      voting_result_title: 'Voting results (round {round})',
      voting_result_none: 'No one was excluded.',
      voting_result_excluded: 'Excluded: {name} ({votes} votes)',
      voting_result_tie: 'Tie — no one excluded.',
      voting_new_vote_btn: 'New vote',
      voting_locked_hint: 'Voting opens starting from round {threshold}. Currently round {round}.',
      voting_locked_players_hint: 'At least 3 alive players are required to vote.',
      voting_title: 'Voting',
      voting_host_hint: 'Start an exclusion vote — everyone will have a limited time to vote.',
      voting_start_btn: 'Start voting',
      voting_seconds_suffix: 'sec.',
      voting_available_hint: 'Voting is available — the host can start it at any time.',
      voting_you_voted_hint: 'You already voted. Tap another player to change your vote.',
      voting_vote_now_hint: 'Pick a player on the right or on their card to cast your vote.',

      chat_title: 'Bunker chat',
      discussion_timer_btn: 'Discussion timer',
      chat_input_placeholder: 'Type a message...',
      default_player_name: 'Player',

      reset_confirm_title: 'Start a new game?',
      reset_confirm_desc: 'Current progress (rounds, revealed attributes, excluded players) will be cleared for everyone in the room. Everyone keeps their seat.',
      btn_confirm_reset: 'Yes, start over',

      event_modal_title: 'Round {round} event',
      situation_discuss_hint: 'Read this situation aloud to everyone and discuss in chat how the bunker should respond.',
      situation_close_btn: 'Discussed',
    },
  };

  function getLang() {
    try {
      const v = localStorage.getItem(LANG_KEY);
      return v === 'en' ? 'en' : 'ru';
    } catch (e) { return 'ru'; }
  }

  function setLang(l) {
    lang = l === 'en' ? 'en' : 'ru';
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* ignore */ }
    updateLangSwitcherUI();
    render();
  }

  function t(key, vars) {
    const dict = I18N[lang] || I18N.ru;
    let str = dict[key];
    if (str === undefined) str = I18N.ru[key] !== undefined ? I18N.ru[key] : key;
    if (vars) {
      Object.keys(vars).forEach((k) => {
        str = str.split('{' + k + '}').join(String(vars[k]));
      });
    }
    return str;
  }

  // Словарь перевода игрового контента (генерируется на сервере всегда на русском —
  // переводим на лету на клиенте при lang === 'en'). Ключ = точный русский текст.
  const CONTENT_EN = {
    'Хирург-трансплантолог': 'Transplant Surgeon',
    'Детский нейрохирург': 'Pediatric Neurosurgeon',
    'Врач-токсиколог': 'Toxicologist',
    'Реаниматолог-анестезиолог': 'Resuscitation Anesthesiologist',
    'Инфекционист-эпидемиолог': 'Infectious Disease Epidemiologist',
    'Ветеринар-хирург крупных животных': 'Large Animal Veterinary Surgeon',
    'Стоматолог-хирург': 'Dental Surgeon',
    'Фармаколог-биохимик': 'Pharmacologist-Biochemist',
    'Психиатр-криминалист': 'Forensic Psychiatrist',
    'Врач скорой помощи (парамедик)': 'Paramedic',
    'Генетик-репродуктолог': 'Reproductive Geneticist',
    'Радиолог-онколог': 'Radiation Oncologist',
    'Инженер-атомщик (реакторщик)': 'Nuclear Engineer (Reactor Specialist)',
    'Инженер систем жизнеобеспечения': 'Life Support Systems Engineer',
    'Гидроинженер-мелиоратор': 'Hydraulic Reclamation Engineer',
    'Инженер-биотехнолог': 'Biotechnology Engineer',
    'Инженер по вентиляции и климат-контролю': 'HVAC and Climate Control Engineer',
    'Инженер-электрик высоковольтных сетей': 'High-Voltage Electrical Engineer',
    'Инженер по опреснению воды': 'Water Desalination Engineer',
    'Инженер-строитель (сейсмоустойчивые конструкции)': 'Structural Engineer (Seismic-Resistant Design)',
    'Инженер-робототехник': 'Robotics Engineer',
    'Инженер-эколог (очистные сооружения)': 'Environmental Engineer (Water Treatment)',
    'Специалист по автономным энергосистемам': 'Off-Grid Power Systems Specialist',
    'Инженер по ядерной безопасности': 'Nuclear Safety Engineer',
    'Программист embedded-систем реального времени': 'Real-Time Embedded Systems Programmer',
    'Специалист по кибербезопасности критической инфраструктуры': 'Critical Infrastructure Cybersecurity Specialist',
    'Инженер по спутниковой связи': 'Satellite Communications Engineer',
    'Специалист по искусственному интеллекту': 'Artificial Intelligence Specialist',
    'Криптограф': 'Cryptographer',
    'Специалист по big data и логистике ресурсов': 'Big Data and Resource Logistics Specialist',
    'Астрофизик': 'Astrophysicist',
    'Микробиолог-почвовед': 'Soil Microbiologist',
    'Ботаник-селекционер (устойчивые культуры)': 'Plant Breeder (Resilient Crops)',
    'Химик-технолог (переработка отходов)': 'Chemical Engineer (Waste Processing)',
    'Сейсмолог-вулканолог': 'Seismologist-Volcanologist',
    'Метеоролог-климатолог': 'Meteorologist-Climatologist',
    'Снайпер спецназа': 'Special Forces Sniper',
    'Сапёр-подрывник': 'Combat Engineer (Demolitions)',
    'Командир штурмовой группы': 'Assault Team Commander',
    'Военный медик-хирург': 'Combat Medic-Surgeon',
    'Специалист РХБЗ (радиационная, химическая, биологическая защита)': 'CBRN Specialist (Radiation, Chemical, Biological Defense)',
    'Инструктор по выживанию': 'Survival Instructor',
    'Кинолог служебных собак': 'Military Working Dog Handler',
    'Пилот военно-транспортной авиации': 'Military Transport Pilot',
    'Оператор беспилотных летательных аппаратов': 'Drone Operator',
    'Агроном-гидропоник': 'Hydroponics Agronomist',
    'Зоотехник (разведение скота в неволе)': 'Livestock Zootechnician (Captive Breeding)',
    'Пчеловод-селекционер': 'Beekeeper-Breeder',
    'Технолог пищевого консервирования': 'Food Canning Technologist',
    'Мельник-пекарь (автономное производство хлеба)': 'Miller-Baker (Self-Sufficient Bread Production)',
    'Специалист по вертикальному земледелию': 'Vertical Farming Specialist',
    'Рыбовод (аквакультура закрытого цикла)': 'Fish Farmer (Closed-Loop Aquaculture)',
    'Сантехник-универсал (автономные системы)': 'Universal Plumber (Off-Grid Systems)',
    'Сварщик высокого разряда': 'High-Grade Welder',
    'Плотник-краснодеревщик': 'Cabinetmaker',
    'Слесарь-инструментальщик': 'Tool-and-Die Mechanic',
    'Мастер по ремонту генераторов': 'Generator Repair Technician',
    'Кузнец-металлург': 'Blacksmith-Metallurgist',
    'Психолог кризисных ситуаций': 'Crisis Psychologist',
    'Историк-архивариус': 'Historian-Archivist',
    'Лингвист-полиглот (10+ языков)': 'Polyglot Linguist (10+ Languages)',
    'Юрист по международному праву': 'International Law Attorney',
    'Социолог малых групп': 'Small Group Sociologist',
    'Переговорщик по освобождению заложников': 'Hostage Negotiator',
    'Педагог-дефектолог': 'Special Education Teacher',
    'Библиотекарь-каталогизатор редких изданий': 'Rare Books Librarian-Cataloguer',
    'Антрополог': 'Anthropologist',
    'Инженер-акустик (звукоизоляция)': 'Acoustic Engineer (Soundproofing)',
    'Художник-реставратор': 'Art Restorer',
    'Актёр-психодраматерапевт': 'Psychodrama Therapist-Actor',
    'Музыкант-терапевт (музтерапия)': 'Music Therapist',
    'Сценарист и режиссёр (поддержание морального духа)': 'Screenwriter and Director (Morale Maintenance)',
    'Часовщик-механик (точная механика)': 'Watchmaker (Precision Mechanics)',
    'Спелеолог-исследователь пещер': 'Cave Explorer-Speleologist',
    'Океанолог-биолог': 'Marine Biologist-Oceanographer',
    'Пилот подводных аппаратов': 'Submersible Pilot',
    'Специалист по опреснению и водоснабжению': 'Water Desalination and Supply Specialist',
    'Криминалист-эксперт': 'Forensic Expert',
    'Таксидермист': 'Taxidermist',
    'Дегустатор и технолог по консервации продуктов': 'Food Preservation Taster and Technologist',
    'Специалист по добыче и переработке урана': 'Uranium Mining and Processing Specialist',
    'Инженер лифтового и подъёмного оборудования': 'Elevator and Lifting Equipment Engineer',
    'Метролог (специалист по измерительным приборам)': 'Metrologist (Measuring Instruments Specialist)',
    'Пилот-испытатель': 'Test Pilot',
    'Специалист по подземным коммуникациям метрополитена': 'Subway Underground Utilities Specialist',
    'Технолог по производству топлива из биомассы': 'Biomass Fuel Production Technologist',
    'Мужчина, 19 лет': 'Male, 19 years old',
    'Женщина, 21 год': 'Female, 21 years old',
    'Мужчина, 24 года': 'Male, 24 years old',
    'Женщина, 27 лет': 'Female, 27 years old',
    'Мужчина, 29 лет': 'Male, 29 years old',
    'Женщина, 32 года': 'Female, 32 years old',
    'Мужчина, 35 лет': 'Male, 35 years old',
    'Женщина, 38 лет': 'Female, 38 years old',
    'Мужчина, 41 год': 'Male, 41 years old',
    'Женщина, 44 года': 'Female, 44 years old',
    'Мужчина, 47 лет': 'Male, 47 years old',
    'Женщина, 50 лет': 'Female, 50 years old',
    'Мужчина, 53 года': 'Male, 53 years old',
    'Женщина, 56 лет': 'Female, 56 years old',
    'Мужчина, 60 лет': 'Male, 60 years old',
    'Женщина, 63 года': 'Female, 63 years old',
    'Мужчина, 17 лет': 'Male, 17 years old',
    'Женщина, 17 лет': 'Female, 17 years old',
    'Мужчина, 68 лет': 'Male, 68 years old',
    'Женщина, 71 год': 'Female, 71 years old',
    'Небинарная персона, 26 лет': 'Non-binary person, 26 years old',
    'Мужчина, 15 лет': 'Male, 15 years old',
    'Женщина, 15 лет': 'Female, 15 years old',
    'Мужчина, 75 лет': 'Male, 75 years old',
    'Абсолютно здоров(а)': 'Perfectly healthy',
    'Лёгкая близорукость (-1.5)': 'Mild nearsightedness (-1.5)',
    'Хронический бронхит': 'Chronic bronchitis',
    'Аллергия на пыльцу и пыль': 'Pollen and dust allergy',
    'Сахарный диабет 2 типа (компенсированный)': 'Type 2 diabetes (well-controlled)',
    'Астма лёгкой степени': 'Mild asthma',
    'Хроническая мигрень': 'Chronic migraines',
    'Сколиоз 1 степени': 'Grade 1 scoliosis',
    'Гипертония 1 стадии': 'Stage 1 hypertension',
    'Полное отсутствие обоняния (аносмия)': 'Complete loss of smell (anosmia)',
    'Один протезированный тазобедренный сустав': 'One hip replacement',
    'Эпилепсия (медикаментозно контролируемая)': 'Epilepsy (medically controlled)',
    'Врождённый порок сердца (компенсированный)': 'Congenital heart defect (compensated)',
    'Хроническая бессонница': 'Chronic insomnia',
    'Псориаз': 'Psoriasis',
    'Пищевая аллергия (орехи)': 'Nut allergy',
    'Артрит суставов рук': 'Arthritis in the hands',
    'Потеря слуха на одно ухо': 'Hearing loss in one ear',
    'ВИЧ+ (на терапии, недетектируемая нагрузка)': 'HIV-positive (on therapy, undetectable viral load)',
    'Бесплодие': 'Infertility',
    'Онкология в стадии ремиссии (2 года)': 'Cancer in remission (2 years)',
    'Протез нижней конечности выше колена': 'Above-knee leg prosthesis',
    'Целиакия (непереносимость глютена)': 'Celiac disease (gluten intolerance)',
    'Здоров(а), но неделю назад был контакт с больным гриппом': 'Healthy, but had contact with a flu patient a week ago',
    'Хроническая анемия': 'Chronic anemia',
    'Панические атаки (без диагноза)': 'Panic attacks (undiagnosed)',
    'Полностью здоров(а), отличная физическая форма': 'Perfectly healthy, excellent physical condition',
    'Варикозное расширение вен': 'Varicose veins',
    'Заикание при стрессе': 'Stress-induced stutter',
    'Ремиссия после инсульта, лёгкий парез руки': 'Post-stroke remission, mild arm paresis',
    'Клаустрофобия (боязнь замкнутых пространств)': 'Claustrophobia (fear of enclosed spaces)',
    'Никтофобия (боязнь темноты)': 'Nyctophobia (fear of the dark)',
    'Мизофобия (боязнь грязи и микробов)': 'Mysophobia (fear of dirt and germs)',
    'Танатофобия (боязнь смерти)': 'Thanatophobia (fear of death)',
    'Социофобия (боязнь общества)': 'Social phobia (fear of society)',
    'Айхмофобия (боязнь острых предметов)': 'Aichmophobia (fear of sharp objects)',
    'Акрофобия (боязнь высоты)': 'Acrophobia (fear of heights)',
    'Гидрофобия (боязнь воды)': 'Hydrophobia (fear of water)',
    'Аутофобия (боязнь одиночества)': 'Autophobia (fear of being alone)',
    'Агорафобия (боязнь открытых пространств)': 'Agoraphobia (fear of open spaces)',
    'Гемофобия (боязнь крови)': 'Hemophobia (fear of blood)',
    'Кинофобия (боязнь собак)': 'Cynophobia (fear of dogs)',
    'Пирофобия (боязнь огня)': 'Pyrophobia (fear of fire)',
    'Энтомофобия (боязнь насекомых)': 'Entomophobia (fear of insects)',
    'Нет фобий': 'No phobias',
    'Трипофобия (боязнь скоплений отверстий)': 'Trypophobia (fear of clusters of holes)',
    'Мегаломанофобия (боязнь больших предметов/толпы)': 'Megalophobia (fear of large objects/crowds)',
    'Фонофобия (боязнь громких звуков)': 'Phonophobia (fear of loud noises)',
    'Ситофобия (боязнь отравленной пищи)': 'Sitophobia (fear of poisoned food)',
    'Технофобия (боязнь техники и механизмов)': 'Technophobia (fear of technology and machinery)',
    'Ксенофобия (страх перед незнакомцами)': 'Xenophobia (fear of strangers)',
    'Некрофобия (боязнь мёртвых тел)': 'Necrophobia (fear of dead bodies)',
    'Клаустрофобия отсутствует, но есть боязнь крыс': 'No claustrophobia, but afraid of rats',
    'Панфобия (смутный постоянный страх без причины)': 'Panphobia (vague constant fear without cause)',
    'Шахматы на профессиональном уровне': 'Professional-level chess',
    'Игра на гитаре и вокал': 'Guitar and singing',
    'Резьба по дереву': 'Wood carving',
    'Скалолазание': 'Rock climbing',
    'Стрельба из лука': 'Archery',
    'Каллиграфия': 'Calligraphy',
    'Разведение аквариумных рыбок': 'Aquarium fishkeeping',
    'Кулинария и выпечка хлеба': 'Cooking and bread baking',
    'Йога и медитация': 'Yoga and meditation',
    'Программирование игр в свободное время': 'Game programming as a hobby',
    'Фотография': 'Photography',
    'Единоборства (карате, чёрный пояс)': 'Martial arts (karate, black belt)',
    'Вязание и шитьё': 'Knitting and sewing',
    'Астрономия и наблюдение за звёздами': 'Astronomy and stargazing',
    'Разгадывание головоломок и квестов': 'Solving puzzles and quests',
    'Коллекционирование монет и марок': 'Coin and stamp collecting',
    'Танцы (бальные)': 'Dancing (ballroom)',
    'Рыбалка': 'Fishing',
    'Ремонт часов и механизмов': 'Clock and mechanism repair',
    'Стендап и импровизация': 'Stand-up and improv',
    'Садоводство': 'Gardening',
    'Игра на баяне/аккордеоне': 'Playing the accordion/bayan',
    'Вокал (оперный)': 'Singing (opera)',
    'Настольные ролевые игры': 'Tabletop role-playing games',
    'Скорочтение и мнемотехники': 'Speed reading and mnemonics',
    'Гончарное дело': 'Pottery',
    'Пение в хоре': 'Choir singing',
    'Пилотирование дронов': 'Drone piloting',
    'Оригами': 'Origami',
    'Плавание на длинные дистанции': 'Long-distance swimming',
    'Выживание в дикой природе (бушкрафт)': 'Wilderness survival (bushcraft)',
    'Игра в покер': 'Playing poker',
    'Шитьё и крой одежды': 'Sewing and dressmaking',
    'Лидерские качества': 'Leadership qualities',
    'Прирождённый дипломат': 'Natural diplomat',
    'Абсолютная честность': 'Absolute honesty',
    'Хладнокровие в критических ситуациях': 'Cool-headed in critical situations',
    'Отличная память': 'Excellent memory',
    'Эмпатия и умение слушать': 'Empathy and good listening skills',
    'Физическая выносливость': 'Physical endurance',
    'Быстрая обучаемость': 'Fast learner',
    'Оптимизм и харизма': 'Optimism and charisma',
    'Хозяйственность и бережливость': 'Resourcefulness and thriftiness',
    'Аналитический склад ума': 'Analytical mindset',
    'Чувство юмора, поднимает боевой дух': 'Sense of humor, boosts morale',
    'Дисциплинированность': 'Discipline',
    'Умение находить компромиссы': 'Skilled at finding compromises',
    'Смелость и решительность': 'Courage and decisiveness',
    'Творческое мышление': 'Creative thinking',
    'Скрупулёзность и внимание к деталям': 'Meticulousness and attention to detail',
    'Настойчивость': 'Persistence',
    'Склонность к паническим атакам в стрессе': 'Prone to panic attacks under stress',
    'Излишняя авторитарность': 'Excessively authoritarian',
    'Патологическая лживость': 'Pathological liar',
    'Вспыльчивость и агрессивность': 'Quick-tempered and aggressive',
    'Клептомания': 'Kleptomania',
    'Игромания (лудомания)': 'Gambling addiction',
    'Алкогольная зависимость (в завязке)': 'Recovering alcoholic',
    'Эгоизм и себялюбие': 'Selfish and self-centered',
    'Склонность к депрессии': 'Prone to depression',
    'Мизантропия': 'Misanthropy',
    'Чрезмерная доверчивость, легко манипулировать': 'Overly trusting, easy to manipulate',
    'Хроническая прокрастинация': 'Chronic procrastination',
    'Мания величия': 'Delusions of grandeur',
    'Скрытность и подозрительность': 'Secretive and suspicious',
    'Расизм/ксенофобские взгляды': 'Racist/xenophobic views',
    'Склонность к предательству ради выгоды': 'Prone to betrayal for personal gain',
    'Трусость в критических ситуациях': 'Cowardice in critical situations',
    'Педантичность до одержимости': 'Obsessive perfectionism',
    'Рюкзак с медикаментами первой необходимости': 'Backpack with essential medications',
    'Ноутбук с картами бомбоубежищ и метро': 'Laptop with bomb shelter and subway maps',
    'Набор слесарных инструментов': 'Set of locksmith tools',
    'Охотничье ружьё и 20 патронов': 'Hunting rifle and 20 rounds',
    'Аптечка военного образца': 'Military-grade first aid kit',
    'Портативная рация': 'Portable radio',
    'Мешок с семенами овощных культур': 'Bag of vegetable seeds',
    'Набор для очистки воды': 'Water purification kit',
    'Генератор на ручной тяге': 'Hand-crank generator',
    'Собака-компаньон (овчарка)': 'Companion dog (German shepherd)',
    'Ящик с консервами (на 2 недели)': 'Crate of canned food (2 weeks\' worth)',
    'Швейцарский нож и набор инструментов выживания': 'Swiss army knife and survival tool kit',
    'Книги по медицине и справочники': 'Medical books and reference guides',
    'Канистра бензина 20 литров': '20-liter gasoline canister',
    'Дозиметр и защитный костюм': 'Dosimeter and protective suit',
    'Ящик с инструментами электрика': 'Box of electrician\'s tools',
    'Спальный мешок и палатка': 'Sleeping bag and tent',
    'Набор химических реактивов': 'Set of chemical reagents',
    'Ноутбук с базой данных выживших': 'Laptop with a survivor database',
    'Музыкальный инструмент (гитара)': 'Musical instrument (guitar)',
    'Личный дневник с важными записями': 'Personal diary with important notes',
    'Фотоаппарат и архив снимков': 'Camera and photo archive',
    'Кот-компаньон': 'Companion cat',
    'Набор игральных карт и настольных игр': 'Deck of cards and board games',
    'Мотоцикл с полным баком': 'Motorcycle with a full tank',
    'Владеет 4 иностранными языками': 'Fluent in 4 foreign languages',
    'Ранее был(а) осуждён(а) за экономическое преступление': 'Previously convicted of an economic crime',
    'Прошёл(ла) действительную военную службу в горячей точке': 'Served active military duty in a conflict zone',
    'Имеет судимость за хранение оружия': 'Has a firearms possession conviction',
    'Является донором универсальной группы крови (I отрицательная)': 'Universal blood type donor (O negative)',
    'Скрытый талант к обучению других': 'Hidden talent for teaching others',
    'В прошлом был(а) волонтёром МЧС': 'Former emergency services volunteer',
    'Страдает бессонницей уже 3 года': 'Has suffered from insomnia for 3 years',
    'Является носителем редкого генетического иммунитета к части вирусов': 'Carries a rare genetic immunity to some viruses',
    'Ранее работал(а) в разведке': 'Formerly worked in intelligence',
    'Воспитывает троих детей в одиночку': 'Raising three children alone',
    'Женат/замужем, супруг(а) остался(лась) снаружи': 'Married, spouse stayed outside',
    'Является убеждённым вегетарианцем': 'A committed vegetarian',
    'Тайно ведёт дневник наблюдений за остальными': 'Secretly keeps a journal observing the others',
    'Имеет опыт выживания в условиях автономного плавания 6 месяцев': 'Has experience surviving 6 months of autonomous sailing',
    'Ранее участвовал(а) в экспедиции на Северный полюс': 'Previously took part in a North Pole expedition',
    'Страдает патологической ревностью': 'Suffers from pathological jealousy',
    'Является публичной персоной / знаменитостью': 'A public figure / celebrity',
    'Имеет крупный долг перед криминальными структурами': 'Has a large debt to criminal organizations',
    'Скрывает беременность (на раннем сроке)': 'Hiding a pregnancy (early stage)',
    'Религиозный лидер небольшой общины': 'Religious leader of a small community',
    'В детстве пережил(а) техногенную катастрофу': 'Survived a technological disaster as a child',
    'Обладает фотографической памятью': 'Has a photographic memory',
    'Ранее судим(а) за хакерство государственных систем': 'Previously convicted of hacking government systems',
    '180 м² на человека — тесное, но функциональное убежище': '180 m² per person — cramped but functional shelter',
    '45 м² на человека — просторный подземный комплекс': '45 m² per person — spacious underground complex',
    '90 м² на человека — стандартное военное бомбоубежище': '90 m² per person — standard military bomb shelter',
    '30 м² на человека — минимальные условия выживания': '30 m² per person — minimal survival conditions',
    '120 м² на человека — бывший научный подземный центр': '120 m² per person — former underground research facility',
    '1 год до предположительного восстановления поверхности': '1 year until the surface is expected to recover',
    '3 года до снижения уровня радиации/токсинов': '3 years until radiation/toxin levels decrease',
    '5 лет до окончания «ядерной зимы»': '5 years until the end of the "nuclear winter"',
    '10 лет — минимальный срок для восстановления экосистемы': '10 years — the minimum time for the ecosystem to recover',
    '20 лет — до возможного появления новой цивилизации': '20 years — until a new civilization might emerge',
    '6 месяцев — краткосрочное убежище от пиковой опасности': '6 months — short-term shelter from peak danger',
    '1 этаж': '1 floor',
    '2 этажа': '2 floors',
    '3 этажа': '3 floors',
    '4 этажа': '4 floors',
    '5 этажей': '5 floors',
    'Оружейная комната с арсеналом': 'Armory with a weapons cache',
    'Медицинский блок с операционной': 'Medical bay with an operating room',
    'Гидропонная теплица для выращивания овощей': 'Hydroponic greenhouse for growing vegetables',
    'Библиотека и архив знаний': 'Library and knowledge archive',
    'Мастерская для ремонта техники': 'Workshop for equipment repair',
    'Спортивный зал': 'Gym',
    'Комната отдыха и психологической разгрузки': 'Recreation and relaxation room',
    'Автономная электростанция': 'Autonomous power plant',
    'Лаборатория для исследований': 'Research laboratory',
    'Хранилище семян и генофонда': 'Seed and gene bank vault',
    'Радиоузел для связи с внешним миром': 'Radio room for communication with the outside world',
    'Дополнительный резервуар с питьевой водой': 'Additional drinking water reservoir',
    'Запасов провизии хватит впритык на заявленное число людей': 'Provisions will last just enough for the stated number of people',
    'Запасов провизии хватит на число людей на 20% меньше расчётного — придётся урезать пайки': 'Provisions will only last for 20% fewer people than planned — rations will need to be cut',
    'Есть небольшой излишек провизии (+15%) благодаря консервации': 'There\'s a small surplus of provisions (+15%) thanks to preserving',
    'Запасы воды ограничены, потребуется строгая экономия': 'Water supplies are limited, strict rationing will be required',
    'Обнаружен дополнительный склад консервов на соседнем уровне (+30%)': 'An additional stash of canned goods was found on the adjacent level (+30%)',
    'В системе вентиляции обнаружена утечка — на ремонт уйдут ценные ресурсы.': 'A leak has been found in the ventilation system — repairs will cost valuable resources.',
    'Один из отсеков бункера затоплен грунтовыми водами. Придётся тесниться.': 'One of the bunker compartments is flooded with groundwater. Everyone will have to squeeze in.',
    'Найден дополнительный тайник с консервами на 2 недели.': 'An additional cache of canned food for 2 weeks has been found.',
    'Внезапный скачок напряжения вывел из строя часть освещения.': 'A sudden power surge knocked out part of the lighting.',
    'Кто-то услышал стук снаружи — возможно, там ещё выжившие.': 'Someone heard knocking outside — there may be other survivors.',
    'Обнаружена плесень в системе вентиляции — риск заболеваний.': 'Mold has been found in the ventilation system — risk of illness.',
    'Радиосвязь поймала обрывок сигнала от другого убежища.': 'The radio picked up a fragment of a signal from another shelter.',
    'Сломался фильтр очистки воды, ремонт займёт время.': 'The water filter has broken, repairs will take time.',
    'Психологическое напряжение нарастает — назревает конфликт между жильцами.': 'Psychological tension is rising — conflict is brewing among the residents.',
    'Обнаружен запасной генератор, но топлива для него мало.': 'A spare generator has been found, but there is little fuel for it.',
    'Один из аварийных выходов завален обломками.': 'One of the emergency exits is blocked by debris.',
    'В хранилище завёлся грызуны — часть еды испорчена.': 'Rodents have infested the storage — some of the food is spoiled.',
    'Пришло время распределить оставшиеся медикаменты.': 'It\'s time to distribute the remaining medications.',
    'Датчики зафиксировали повышение радиационного фона снаружи.': 'Sensors have detected a rise in the radiation level outside.',
    'Найдена карта окрестностей — возможно, есть путь к спасению.': 'A map of the surrounding area has been found — there may be a path to safety.',
    'Один из жителей бункера тяжело заболел — необходима помощь врача.': 'One of the bunker\'s residents has fallen seriously ill — a doctor\'s help is needed.',
    'Ядерная война': 'Nuclear War',
    'Массированный обмен ядерными ударами между крупнейшими державами стёр с лица земли большинство мегаполисов. Радиационный фон на поверхности смертельно опасен, воздух насыщен радиоактивной пылью. Ядерная зима может продлиться десятилетия.': 'A massive exchange of nuclear strikes between the world\'s major powers has wiped most megacities off the map. Radiation levels on the surface are lethal, the air is thick with radioactive dust. The nuclear winter could last decades.',
    'Пандемия «Штамм Омега»': 'Pandemic "Strain Omega"',
    'Мутировавший вирус с летальностью 92% и воздушно-капельным путём передачи выкосил большую часть населения планеты за 3 месяца. Заражённые впадают в агрессивное бредовое состояние на последней стадии болезни.': 'A mutated airborne virus with a 92% mortality rate wiped out most of the planet\'s population in 3 months. In the final stage of the disease, the infected fall into an aggressive, delirious state.',
    'Падение астероида': 'Asteroid Impact',
    'Астероид диаметром 4 км врезался в Атлантический океан. Мегацунами высотой до 200 метров смыло прибрежные города, а поднятая пыль закрыла солнце на неопределённый срок, вызвав резкое похолодание.': 'A 4-km-diameter asteroid struck the Atlantic Ocean. A mega-tsunami up to 200 meters high swept away coastal cities, and the dust thrown into the atmosphere has blocked out the sun indefinitely, causing sharp cooling.',
    'Восстание искусственного интеллекта': 'Artificial Intelligence Uprising',
    'Военный ИИ «Аргус», получивший контроль над автономным вооружением, счёл человечество угрозой и начал скоординированную атаку боевых дронов и роботов на населённые пункты.': 'The military AI "Argus", having gained control over autonomous weapons systems, deemed humanity a threat and launched a coordinated attack of combat drones and robots on populated areas.',
    'Зомби-апокалипсис': 'Zombie Apocalypse',
    'Секретный биологический препарат вырвался на свободу из военной лаборатории. Заражённые теряют разум, становятся крайне агрессивными и передают инфекцию через укус. Города превратились в зоны кишащие зомби.': 'A secret biological agent escaped from a military laboratory. The infected lose their minds, become extremely aggressive, and transmit the infection through bites. Cities have turned into zones swarming with zombies.',
    'Глобальное затопление': 'Global Flooding',
    'Резкое таяние ледников Антарктиды и Гренландии подняло уровень мирового океана на 60 метров за несколько недель. Континенты превратились в архипелаги, большинство прибрежных цивилизаций поглощены водой.': 'Rapid melting of the Antarctic and Greenland ice sheets raised global sea levels by 60 meters within a few weeks. Continents turned into archipelagos, most coastal civilizations were swallowed by water.',
    'Супервулкан Йеллоустоун': 'Yellowstone Supervolcano',
    'Извержение супервулкана выбросило в атмосферу триллионы тонн пепла. Вулканическая зима накрыла планету, солнечный свет почти не проникает сквозь пепельные облака, температура упала на 15°C.': 'The eruption of a supervolcano threw trillions of tons of ash into the atmosphere. A volcanic winter blanketed the planet, sunlight barely penetrates the ash clouds, temperatures dropped by 15°C.',
    'Химическая катастрофа': 'Chemical Disaster',
    'Авария на крупном химическом комбинате выбросила в атмосферу облако нервно-паралитического газа, распространившееся на тысячи километров благодаря аномальным воздушным потокам. Всё живое на поверхности в опасности.': 'An accident at a major chemical plant released a cloud of nerve gas into the atmosphere, which spread thousands of kilometers due to anomalous air currents. All life on the surface is in danger.',
    'Вторжение инопланетной формы жизни': 'Alien Life Form Invasion',
    'Неопознанные биологические организмы, прибывшие на землю неизвестным образом, начали агрессивно распространяться, поглощая ресурсы и уничтожая экосистему. Их природа и уязвимости почти не изучены.': 'Unidentified biological organisms, arriving on Earth by unknown means, began spreading aggressively, consuming resources and destroying the ecosystem. Their nature and weaknesses are barely understood.',
    'Магнитная буря и коллапс электросети': 'Magnetic Storm and Power Grid Collapse',
    'Аномально мощная вспышка на Солнце вызвала глобальный коллапс электросетей и спутниковой связи. Отказ систем жизнеобеспечения в мегаполисах привёл к хаосу, мародёрству и гражданской войне.': 'An abnormally powerful solar flare caused a global collapse of power grids and satellite communications. The failure of life-support systems in megacities led to chaos, looting and civil war.',
    'Экологический коллапс': 'Ecological Collapse',
    'Многолетнее загрязнение атмосферы достигло критической точки: кислород в воздухе упал до 14%, а концентрация токсичных веществ сделала поверхность земли непригодной для дыхания без фильтрации.': 'Decades of atmospheric pollution reached a critical point: oxygen levels in the air dropped to 14%, and the concentration of toxic substances made the Earth\'s surface unbreathable without filtration.',
    'Мировая ядерная зима после локального конфликта': 'Global Nuclear Winter After a Local Conflict',
    'Ограниченный региональный ядерный конфликт между двумя странами вызвал непропорционально мощный климатический эффект — глобальное похолодание и неурожаи по всей планете, спровоцировавшие голод и войны за ресурсы.': 'A limited regional nuclear conflict between two countries caused a disproportionately powerful climate effect — global cooling and crop failures across the planet, triggering famine and wars over resources.',
    'Генетически модифицированная чума растений': 'Genetically Modified Plant Plague',
    'Из-за утечки на агробиологическом предприятии мутировавший грибок уничтожил более 90% сельскохозяйственных культур планеты, вызвав мировой голод и коллапс продовольственных цепочек.': 'Due to a leak at an agrobiological facility, a mutated fungus destroyed over 90% of the planet\'s agricultural crops, causing a global famine and the collapse of food supply chains.',
    'Тектонический разлом': 'Tectonic Rift',
    'Серия аномальных землетрясений магнитудой выше 9.5 расколола несколько континентальных плит. Массовые разрушения, цунами и извержения сопутствующих вулканов сделали поверхность крайне опасной.': 'A series of anomalous earthquakes with a magnitude above 9.5 split several continental plates. Massive destruction, tsunamis, and accompanying volcanic eruptions have made the surface extremely dangerous.',
    'Гамма-всплеск от близкой сверхновой': 'Gamma-Ray Burst from a Nearby Supernova',
    'Взрыв сверхновой звезды в относительной близости к Солнечной системе обрушил на Землю поток гамма-излучения, разрушивший озоновый слой. Поверхность планеты теперь подвержена смертельному уровню УФ-радиации.': 'The explosion of a supernova relatively close to the Solar System unleashed a stream of gamma radiation onto Earth, destroying the ozone layer. The planet\'s surface is now exposed to lethal levels of UV radiation.',
    'Нашествие мутировавших насекомых': 'Invasion of Mutated Insects',
    'В результате бесконтрольного применения агрохимикатов возникла популяция гигантских агрессивных насекомых, стремительно размножающихся и представляющих смертельную опасность для человека.': 'As a result of uncontrolled use of agrochemicals, a population of giant aggressive insects emerged, rapidly multiplying and posing a deadly danger to humans.',
    'Лишний рот': 'An Extra Mouth to Feed',
    'Один из выживших признаётся, что тайно провёл в бункер своего родственника — он не проходил отбор и не входит в расчётное число мест. Еды и кислорода на всех может не хватить. Бункер должен решить: разрешить остаться незваному гостю, изгнать его обратно на поверхность или исключить из числа выживших того, кто его привёл.': 'One of the survivors admits to secretly bringing a relative into the bunker — someone who was never vetted and isn\'t counted among the allotted spots. There may not be enough food and oxygen for everyone. The bunker must decide: let the uninvited guest stay, cast them out to the surface, or exclude the survivor who brought them in.',
    'Сигнал извне': 'A Signal From Outside',
    'Радист поймал слабый сигнал — группа выживших неподалёку просит впустить их в обмен на запасы топлива и медикаментов. Открыть шлюз — риск заражения или нападения. Отказать — потерять ценные ресурсы и, возможно, обречь людей на гибель.': 'The radio operator picked up a weak signal — a group of survivors nearby is asking to be let in, in exchange for fuel and medical supplies. Opening the airlock risks infection or attack. Refusing means losing valuable resources and possibly condemning those people to death.',
    'Отказ системы фильтрации': 'Filtration System Failure',
    'Главный фильтр воздуха вышел из строя. Резервной системы хватит лишь на ограниченное количество человек в течение суток, пока идёт ремонт. Придётся временно эвакуировать часть жильцов в менее защищённый отсек с худшей вентиляцией.': 'The main air filter has broken down. The backup system will only support a limited number of people for a day while repairs are underway. Some residents will have to be temporarily evacuated to a less protected, poorly ventilated compartment.',
    'Раскол мнений': 'A Split in Opinion',
    'Часть выживших предлагает ввести жёсткий комендантский час и нормирование пищи под контролем «совета старейшин». Другая часть считает это узурпацией власти и требует равного голоса для всех. Напряжение в бункере растёт.': 'Some survivors propose a strict curfew and food rationing controlled by a "council of elders". Others see this as a power grab and demand an equal voice for everyone. Tension in the bunker is rising.',
    'Заброшенный склад': 'Abandoned Storage',
    'Разведгруппа обнаружила соседний заброшенный бункер с остатками припасов, но часть помещений обрушена, а внутри слышны подозрительные звуки. Исследовать находку — шанс пополнить запасы, но и риск для отправленных туда людей.': 'A scouting party discovered a neighboring abandoned bunker with leftover supplies, but part of it has collapsed and suspicious sounds can be heard inside. Exploring the find is a chance to restock supplies, but also a risk for those sent there.',
    'Подозрение на заражение': 'Suspected Infection',
    'У одного из жильцов внезапно поднялась температура и появился кашель. Врач не может точно сказать, обычная ли это простуда или начало болезни, свирепствующей на поверхности. Изолировать его — разумная мера, но это может быть излишней жестокостью к невиновному.': 'One of the residents suddenly developed a fever and a cough. The doctor can\'t say for sure whether it\'s an ordinary cold or the onset of the disease raging on the surface. Isolating them is a reasonable precaution, but it could be needless cruelty to an innocent person.',
    'Пополнение в семье': 'A New Addition to the Family',
    'Стало известно, что одна из женщин в бункере беременна. Это радостная новость, но лишний человек через несколько месяцев означает дополнительную нагрузку на и без того ограниченные запасы еды, воды и медицины.': 'It has become known that one of the women in the bunker is pregnant. This is joyful news, but an extra person in a few months means additional strain on the already limited supplies of food, water, and medicine.',
    'Утечка топлива': 'Fuel Leak',
    'Обнаружена трещина в топливном баке генератора. Часть драгоценного топлива уже потеряна, а без ремонта электричество может отключиться в самый неподходящий момент. На ремонт нужны детали, которых в бункере может не быть.': 'A crack has been found in the generator\'s fuel tank. Some of the precious fuel has already been lost, and without repairs the electricity could go out at the worst possible moment. Repairs require parts that the bunker may not have.',
    'Военный патруль': 'Military Patrol',
    'На поверхности замечен вооружённый патруль в форме неизвестной принадлежности. Они пока не заметили вентиляционные выходы бункера. Стоит ли попытаться выйти на контакт в надежде на организованную помощь, или лучше затаиться и не рисковать?': 'An armed patrol of unknown affiliation has been spotted on the surface. They haven\'t noticed the bunker\'s ventilation outlets yet. Should the bunker attempt to make contact in hopes of organized help, or is it better to stay hidden and not risk it?',
    'Кража из общих запасов': 'Theft From the Common Stores',
    'Кто-то тайно ворует еду из общего хранилища по ночам. Улики указывают на нескольких подозреваемых. Если виновного не найти, атмосфера доверия в бункере будет разрушена, а голодающие могут начать самосуд.': 'Someone has been secretly stealing food from the communal storage at night. The evidence points to several suspects. If the culprit isn\'t found, the atmosphere of trust in the bunker will be destroyed, and the hungry may resort to mob justice.',
    'Странный дневник': 'A Strange Diary',
    'В одном из подсобных помещений найден дневник предыдущих обитателей бункера. Последние записи обрываются на полуслове и описывают нарастающую панику и странные звуки из вентиляции. Стоит ли рассказать об этом всем, или лучше сохранить в тайне, чтобы не сеять панику?': 'A diary belonging to the bunker\'s previous inhabitants was found in one of the utility rooms. The last entries break off mid-sentence and describe rising panic and strange sounds from the ventilation. Should everyone be told about this, or is it better kept secret to avoid spreading panic?',
    'Нашествие вредителей': 'Pest Infestation',
    'В хранилище продовольствия обнаружена колония крупных насекомых, устойчивых к обычным методам травли. Они быстро размножаются и портят запасы. Радикальные меры борьбы могут повредить и без того скудные припасы.': 'A colony of large insects resistant to conventional pest control methods has been found in the food storage. They are rapidly multiplying and spoiling the supplies. Drastic countermeasures could damage the already scarce provisions.',
    'Тяжелораненый снаружи': 'A Severely Wounded Person Outside',
    'У главного шлюза обнаружен тяжелораненый человек, зовущий на помощь. Открыть дверь даже на несколько секунд — риск впустить заражённый воздух или радиацию. Оставить его снаружи означает верную смерть для него.': 'A severely wounded person calling for help has been found at the main airlock. Opening the door even for a few seconds risks letting in contaminated air or radiation. Leaving them outside means certain death for them.',
    'Борьба за лидерство': 'A Struggle for Leadership',
    'Два авторитетных члена группы одновременно претендуют на роль руководителя бункера, предлагая противоположные стратегии выживания. Остальным приходится выбирать сторону, что раскалывает коллектив на два лагеря.': 'Two respected members of the group are simultaneously claiming the role of bunker leader, each proposing opposing survival strategies. The rest are forced to pick a side, splitting the community into two camps.',
    'Отключение электричества': 'Power Outage',
    'Короткое замыкание обесточило половину бункера, включая часть систем жизнеобеспечения. Ремонтная бригада работает в темноте и тесноте, а резервных батарей хватит лишь на несколько часов.': 'A short circuit has cut power to half the bunker, including part of the life-support systems. The repair crew is working in darkness and cramped conditions, and the backup batteries will only last a few hours.',
    'Карта безопасного маршрута': 'A Map of a Safe Route',
    'Среди вещей одного из выживших находят старую карту с отметками предположительно безопасных зон на поверхности. Информация может быть устаревшей или ложной, но это единственная имеющаяся зацепка для будущей эвакуации.': 'Among one of the survivor\'s belongings, an old map is found marking presumably safe zones on the surface. The information may be outdated or false, but it\'s the only lead available for a future evacuation.',
    'Трещина в стене бункера': 'A Crack in the Bunker Wall',
    'При очередном подземном толчке в несущей стене бункера появилась трещина. Инженеры расходятся во мнениях: одни считают это косметическим повреждением, другие — предвестником обрушения целого отсека.': 'During another underground tremor, a crack appeared in one of the bunker\'s load-bearing walls. The engineers disagree: some consider it cosmetic damage, others a warning sign of an entire compartment\'s collapse.',
    'Ограниченные лекарства': 'Limited Medication',
    'В аптечке осталась только одна доза редкого антибиотика, а тяжело больны сразу двое: пожилой основатель общины и молодая мать с ребёнком. Кому отдать единственный шанс на выздоровление?': 'Only one dose of a rare antibiotic remains in the first aid kit, and two people are seriously ill at once: the elderly founder of the community and a young mother with a child. Who gets the only chance at recovery?',
    'Обращение из столицы': 'A Broadcast From the Capital',
    'Уцелевшая государственная радиостанция объявляет о формировании эвакуационного конвоя, который будет проходить в нескольких километрах от бункера через три дня. Путь до точки сбора труден и небезопасен, а информация не может быть проверена.': 'A surviving government radio station announces the formation of an evacuation convoy that will pass a few kilometers from the bunker in three days. The route to the meeting point is difficult and unsafe, and the information cannot be verified.',
    'Утаённая информация': 'Withheld Information',
    'Выясняется, что один из жильцов с самого начала скрывал важную информацию о своём прошлом или состоянии здоровья, которая могла повлиять на решение о его допуске в бункер. Как поступить с обманувшим доверие сообщества?': 'It turns out that one of the residents had been hiding important information about their past or health condition from the very start — information that could have affected the decision to let them into the bunker. What should be done with someone who betrayed the community\'s trust?',
    'Всходы в теплице': 'Seedlings in the Greenhouse',
    'Вопреки всем ожиданиям, часть посаженных семян неожиданно дала всходы в гидропонной теплице. Это шанс разнообразить рацион, но требует дополнительных ресурсов на уход и защиту от вредителей.': 'Against all expectations, some of the planted seeds have unexpectedly sprouted in the hydroponic greenhouse. This is a chance to diversify the diet, but it requires additional resources for care and pest protection.',
    'Возгорание в отсеке': 'Fire in a Compartment',
    'В техническом отсеке начался пожар из-за перегрузки проводки. Дым быстро распространяется по вентиляции. Тушение потребует использования части драгоценного запаса воды и может повредить оборудование.': 'A fire has broken out in the technical compartment due to wiring overload. Smoke is quickly spreading through the ventilation. Putting it out will require using some of the precious water supply and may damage equipment.',
    'Возврат изгнанного': 'The Exile\'s Return',
    'Ранее исключённый из бункера человек вернулся к шлюзу и умоляет впустить его обратно, утверждая, что снаружи невозможно выжить. Впустить его — значит нарушить принятое сообществом решение и уменьшить и без того скудные ресурсы.': 'A person previously excluded from the bunker has returned to the airlock, begging to be let back in, claiming it\'s impossible to survive outside. Letting them in would mean overturning the community\'s decision and further straining already scarce resources.',
    'Прорыв канализации': 'Sewage System Rupture',
    'Из-за смещения грунта прорвало канализационную систему бункера. Нечистоты грозят затопить нижний уровень и заразить питьевую воду, если проблему не устранить в кратчайшие сроки.': 'Due to ground shifting, the bunker\'s sewage system has ruptured. Waste threatens to flood the lower level and contaminate the drinking water if the problem isn\'t fixed quickly.',
    'Моральная дилемма': 'Moral Dilemma',
    'Внешний контакт': 'External Contact',
    'Технический сбой': 'Technical Failure',
    'Внутренний конфликт': 'Internal Conflict',
    'Находка': 'Discovery',
    'Угроза': 'Threat',
    'Обсуждение': 'Discussion',
  };

  // Переводит игровой (сгенерированный) контент: если lang==en и есть перевод — вернёт его,
  // иначе возвращает исходный текст (русский) как есть.
  function tc(text) {
    if (lang !== 'en' || text == null) return text;
    const s = String(text);
    if (CONTENT_EN[s] !== undefined) return CONTENT_EN[s];
    // Дефолтное имя игрока, если он не ввёл своё (сервер генерирует "Игрок N")
    const defaultNameMatch = s.match(/^Игрок (\d+)$/);
    if (defaultNameMatch) return `Player ${defaultNameMatch[1]}`;
    return s;
  }

  // ---------------------------------------------------------------------
  // Перевод системных сообщений чата (приходят с сервера всегда на русском,
  // так как формируются в src/rooms.ts). Распознаём известные шаблоны через
  // регулярные выражения и пересобираем сообщение на английском, переводя
  // вложенный игровой контент (названия катастроф/ситуаций/событий) через tc().
  // Если сообщение не подходит ни под один шаблон — возвращается как есть.
  // ---------------------------------------------------------------------

  const SYSTEM_MSG_FIELD_LABELS_RU = {
    'Возраст / пол': 'ageGender',
    'Здоровье': 'health',
    'Хобби': 'hobby',
    'Фобия': 'phobia',
    'Черта характера (+)': 'traitPositive',
    'Черта характера (−)': 'traitNegative',
    'Инвентарь': 'inventory',
    'Доп. информация': 'extraInfo',
  };

  function translateSystemMessage(text) {
    if (lang !== 'en' || !text) return text;
    const s = String(text);
    let m;

    m = s.match(/^Комната\s+(\S+)\s+создана\. Мест: (\d+)\.$/);
    if (m) return `Room ${m[1]} created. Seats: ${m[2]}.`;

    m = s.match(/^(.+?) присоединился\(лась\) к бункеру \(место (\d+)\)\.$/);
    if (m) return `${m[1]} joined the bunker (seat ${m[2]}).`;

    m = s.match(/^☢ Катастрофа: «(.+)»\. Досье выживших сгенерированы\.$/);
    if (m) return `☢ Catastrophe: "${tc(m[1])}". Survivor dossiers have been generated.`;

    if (s === '🚪 Все спустились в бункер. Начинается раунд 1.') {
      return '🚪 Everyone has entered the bunker. Round 1 begins.';
    }

    m = s.match(/^(.+?) раскрыл\(а\) характеристику «(.+)»\.$/);
    if (m) {
      const fieldKey = SYSTEM_MSG_FIELD_LABELS_RU[m[2]];
      const label = fieldKey ? t('attr_' + fieldKey) : m[2];
      return `${m[1]} revealed the "${label}" trait.`;
    }

    m = s.match(/^❌ (.+?) исключён\(а\) из бункера\.$/);
    if (m) return `❌ ${m[1]} was excluded from the bunker.`;

    m = s.match(/^✅ (.+?) возвращён\(а\) в бункер\.$/);
    if (m) return `✅ ${m[1]} was returned to the bunker.`;

    m = s.match(/^⏱ Раунд (\d+) начался\. Событие: (.+)$/);
    if (m) return `⏱ Round ${m[1]} has begun. Event: ${tc(m[2])}`;

    m = s.match(/^📢 Ситуация озвучена: «(.+)» — обсудите вслух!$/);
    if (m) return `📢 Situation announced: "${tc(m[1])}" — discuss it out loud!`;

    m = s.match(/^⏱ Запущен таймер «(.+)» на (\d+) сек\.$/);
    if (m) return `⏱ Timer "${tc(m[1])}" started for ${m[2]} sec.`;

    m = s.match(/^🗳 Голосование за исключение открыто! У вас (\d+) сек\.$/);
    if (m) return `🗳 Exclusion vote is open! You have ${m[1]} sec.`;

    m = s.match(/^🗳 Голосование завершено: (.+?) исключён\(а\) из бункера \((\d+) голос\(ов\)\)\.$/);
    if (m) {
      const name = m[1] === 'игрок' ? 'player' : m[1];
      return `🗳 Vote finished: ${name} was excluded from the bunker (${m[2]} vote(s)).`;
    }

    if (s === '🗳 Голосование завершено ничьей — никто не исключён. Требуется обсуждение или повторное голосование.') {
      return '🗳 The vote ended in a tie — no one was excluded. Discussion or a revote is needed.';
    }

    if (s === '🗳 Голосование завершено — голосов не было подано, никто не исключён.') {
      return '🗳 The vote ended — no votes were cast, no one was excluded.';
    }

    if (s === '🗳 Голосование отменено хостом.') {
      return '🗳 The vote was cancelled by the host.';
    }

    if (s === '🔄 Игра сброшена. Возврат в лобби.') {
      return '🔄 The game has been reset. Returning to the lobby.';
    }

    m = s.match(/^🏆 Бункер укомплектован \((\d+)\/(\d+) мест\)! Победители: (.+)\. Игра окончена\.$/);
    if (m) return `🏆 The bunker is fully staffed (${m[1]}/${m[2]} seats)! Winners: ${m[3]}. Game over.`;

    return s;
  }

  const ATTR_FIELDS = [
    { key: 'ageGender', icon: 'fa-id-card' },
    { key: 'health', icon: 'fa-heart-pulse' },
    { key: 'hobby', icon: 'fa-mask' },
    { key: 'phobia', icon: 'fa-eye' },
    { key: 'traitPositive', icon: 'fa-thumbs-up' },
    { key: 'traitNegative', icon: 'fa-thumbs-down' },
    { key: 'inventory', icon: 'fa-box-archive' },
    { key: 'extraInfo', icon: 'fa-file-lines' },
  ];

  // ---------------------------------------------------------------------
  // ЗВУК — лёгкий синтезатор на Web Audio API, без внешних аудиофайлов
  // (не требует размещения бинарных ассетов на Cloudflare Pages).
  // Все звуки — короткие процедурно сгенерированные сигналы. Включение/
  // выключение хранится в localStorage и переключается отдельной кнопкой,
  // симметричной языковому переключателю.
  // ---------------------------------------------------------------------

  let audioCtx = null;
  let soundOn = getSoundPref();
  let soundSwitcherEl = null;

  function getSoundPref() {
    try {
      const v = localStorage.getItem(SOUND_KEY);
      return v === null ? true : v === '1';
    } catch (e) { return true; }
  }

  function setSoundPref(on) {
    soundOn = on;
    try { localStorage.setItem(SOUND_KEY, on ? '1' : '0'); } catch (e) { /* ignore */ }
    updateSoundSwitcherUI();
  }

  function ensureAudioCtx() {
    if (!soundOn) return null;
    if (!audioCtx) {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) audioCtx = new Ctx();
      } catch (e) { audioCtx = null; }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  // Проигрывает последовательность коротких тонов (простой синтез огибающей).
  // notes: [{ freq, start, dur, type, gain }]
  function playTones(notes) {
    const ctx = ensureAudioCtx();
    if (!ctx) return;
    const master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);
    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = n.type || 'sine';
      osc.frequency.value = n.freq;
      const t0 = ctx.currentTime + (n.start || 0);
      const dur = n.dur || 0.12;
      const peak = n.gain != null ? n.gain : 0.9;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(peak, t0 + Math.min(0.02, dur * 0.3));
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    });
  }

  function playNoiseBurst(dur, gainPeak) {
    const ctx = ensureAudioCtx();
    if (!ctx) return;
    const bufSize = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = gainPeak != null ? gainPeak : 0.15;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }

  const SFX = {
    click: () => playTones([{ freq: 720, start: 0, dur: 0.06, type: 'triangle', gain: 0.5 }]),
    reveal: () => playTones([
      { freq: 440, start: 0, dur: 0.1, type: 'sine', gain: 0.6 },
      { freq: 660, start: 0.07, dur: 0.16, type: 'sine', gain: 0.7 },
    ]),
    exclude: () => playTones([
      { freq: 300, start: 0, dur: 0.18, type: 'sawtooth', gain: 0.5 },
      { freq: 180, start: 0.1, dur: 0.28, type: 'sawtooth', gain: 0.55 },
    ]),
    vote: () => playTones([{ freq: 520, start: 0, dur: 0.08, type: 'square', gain: 0.35 }]),
    alarm: () => {
      playNoiseBurst(0.25, 0.08);
      playTones([
        { freq: 220, start: 0, dur: 0.22, type: 'sawtooth', gain: 0.55 },
        { freq: 196, start: 0.24, dur: 0.22, type: 'sawtooth', gain: 0.55 },
      ]);
    },
    victory: () => playTones([
      { freq: 523.25, start: 0, dur: 0.18, type: 'triangle', gain: 0.6 },
      { freq: 659.25, start: 0.15, dur: 0.18, type: 'triangle', gain: 0.6 },
      { freq: 784.0, start: 0.3, dur: 0.32, type: 'triangle', gain: 0.7 },
    ]),
    message: () => playTones([{ freq: 900, start: 0, dur: 0.05, type: 'sine', gain: 0.3 }]),
    toast: () => playTones([{ freq: 600, start: 0, dur: 0.07, type: 'sine', gain: 0.4 }]),
    timerTick: () => playTones([{ freq: 1100, start: 0, dur: 0.04, type: 'square', gain: 0.22 }]),
    open: () => playTones([
      { freq: 330, start: 0, dur: 0.09, type: 'triangle', gain: 0.45 },
      { freq: 494, start: 0.06, dur: 0.12, type: 'triangle', gain: 0.5 },
    ]),
  };

  function playSfx(name) {
    if (!soundOn) return;
    const fn = SFX[name];
    if (fn) { try { fn(); } catch (e) { /* ignore autoplay/policy errors */ } }
  }

  function ensureSoundSwitcher() {
    soundSwitcherEl = document.getElementById('sound-switcher-btn');
    if (!soundSwitcherEl) {
      soundSwitcherEl = document.createElement('button');
      soundSwitcherEl.id = 'sound-switcher-btn';
      soundSwitcherEl.className = 'sound-switcher-btn';
      soundSwitcherEl.type = 'button';
      soundSwitcherEl.addEventListener('click', () => {
        setSoundPref(!soundOn);
        if (soundOn) { ensureAudioCtx(); playSfx('click'); }
      });
      document.body.appendChild(soundSwitcherEl);
    }
    updateSoundSwitcherUI();
  }

  function updateSoundSwitcherUI() {
    if (!soundSwitcherEl) return;
    soundSwitcherEl.classList.toggle('on', soundOn);
    soundSwitcherEl.classList.toggle('muted', !soundOn);
    soundSwitcherEl.title = t(soundOn ? 'sound_switch_title_on' : 'sound_switch_title_off');
    soundSwitcherEl.innerHTML = `<i class="fa-solid ${soundOn ? 'fa-volume-high' : 'fa-volume-xmark'}"></i>`;
  }

  // ---------------------------------------------------------------------
  // АТМОСФЕРНЫЕ ЧАСТИЦЫ (искры/пепел) — создаются один раз в body при
  // init(), вне #app, поэтому НЕ пересоздаются при перерисовке экрана
  // поллингом и их бесконечные CSS-анимации никогда не "мигают".
  // ---------------------------------------------------------------------

  function ensureAmbientParticles() {
    if (document.getElementById('ambient-particles')) return;
    const layer = document.createElement('div');
    layer.id = 'ambient-particles';
    layer.className = 'ambient-particles';
    layer.setAttribute('aria-hidden', 'true');
    const colors = ['#e8631f', '#b8460e', '#d9a721'];
    const count = window.innerWidth < 640 ? 10 : 18;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('span');
      p.className = 'ambient-particle';
      const size = (2 + Math.random() * 3).toFixed(1);
      const dur = (10 + Math.random() * 10).toFixed(1);
      const delay = (-Math.random() * 20).toFixed(1);
      const drift = Math.round((Math.random() - 0.5) * 120);
      const maxOpacity = (0.25 + Math.random() * 0.35).toFixed(2);
      p.style.setProperty('--px', Math.random() * 100 + '%');
      p.style.setProperty('--psize', size + 'px');
      p.style.setProperty('--pdur', dur + 's');
      p.style.setProperty('--pdelay', delay + 's');
      p.style.setProperty('--pdrift', drift + 'px');
      p.style.setProperty('--pmax', maxOpacity);
      p.style.setProperty('--pcolor', colors[i % colors.length]);
      layer.appendChild(p);
    }
    document.body.appendChild(layer);
  }

  // ---------------------------------------------------------------------
  // RIPPLE — делегированный обработчик клика по кнопкам: добавляет
  // короткоживущий элемент .ripple-el, который сам удаляет себя после
  // окончания анимации. Не хранит состояние и не влияет на рендер.
  // ---------------------------------------------------------------------

  function attachGlobalRipple() {
    document.addEventListener('click', (e) => {
      const target = e.target.closest('.btn, .icon-toggle, .attr-reroll, .vote-btn-small, .vote-target-btn, .mp-tab, .seat-cell.empty, .player-card-face');
      if (!target || target.disabled) return;
      const rect = target.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 1.4;
      const ripple = document.createElement('span');
      ripple.className = 'ripple-el';
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
      ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
      const prevPosition = getComputedStyle(target).position;
      if (prevPosition === 'static') target.style.position = 'relative';
      target.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    }, true);
  }

  // ---------------------------------------------------------------------
  // Конфетти на экране победы — одноразовый залп, генерируется только
  // при реальном переходе на экран victory (не при поллинге).
  // ---------------------------------------------------------------------

  function spawnConfetti() {
    const layer = document.getElementById('confetti-layer');
    if (!layer) return;
    const colors = ['var(--toxic)', 'var(--warning)', 'var(--rust-light)', '#e8631f', '#d9a721'];
    const count = window.innerWidth < 640 ? 40 : 70;
    let html = '';
    for (let i = 0; i < count; i++) {
      const cx = Math.random() * 100;
      const csize = 5 + Math.random() * 7;
      const ccolor = colors[Math.floor(Math.random() * colors.length)];
      const cdur = 1.8 + Math.random() * 1.6;
      const cdelay = Math.random() * 0.5;
      const crot = Math.round(Math.random() * 360);
      html += `<span class="confetti-piece" style="--cx:${cx}%;--csize:${csize}px;--ccolor:${ccolor};--cdur:${cdur}s;--cdelay:${cdelay}s;--crot:${crot}deg;"></span>`;
    }
    layer.innerHTML = html;
  }

  // ---------------------------------------------------------------------
  // Онбординг: подсказка "как играть" на игровом экране (первый вход
  // в игру за сессию) + модалка "как начать" при первом визите вообще.
  // ---------------------------------------------------------------------

  let gameHintDismissed = false;

  function maybeShowFirstVisitHowTo() {
    try {
      if (localStorage.getItem(SEEN_HOWTO_KEY)) return;
      localStorage.setItem(SEEN_HOWTO_KEY, '1');
    } catch (e) { /* ignore */ }
    setTimeout(() => showHowToModal(), 900);
  }

  function gameHintBannerHtml() {
    if (gameHintDismissed) return '';
    try { if (localStorage.getItem(SEEN_HOWTO_KEY + '_hint_dismissed')) return ''; } catch (e) { /* ignore */ }
    return `
      <div class="game-hint-banner" id="game-hint-banner">
        <div class="hint-inner">
          <i class="fa-solid fa-lightbulb hint-icon"></i>
          <div class="hint-text">${t('game_hint_text')}</div>
          <button class="hint-close" id="game-hint-close-btn" title="${t('game_hint_close_title')}" type="button">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>
    `;
  }

  function attachGameHintHandler() {
    const closeBtn = document.getElementById('game-hint-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => {
      gameHintDismissed = true;
      try { localStorage.setItem(SEEN_HOWTO_KEY + '_hint_dismissed', '1'); } catch (e) { /* ignore */ }
      const banner = document.getElementById('game-hint-banner');
      if (banner) banner.remove();
    });
  }

  // ---------------------------------------------------------------------
  // Состояние клиента
  // ---------------------------------------------------------------------

  let session = getSession();           // { code, token } | null
  let lastData = null;                  // последний ответ /state
  let currentView = null;               // home | seat-select | lobby | catastrophe | game
  let pollHandle = null;
  let tickHandle = null;
  let lang = getLang();                 // 'ru' | 'en' — язык интерфейса

  let homeScreen = 'landing';   // 'landing' | 'play' | 'settings'
  let createCount = 8;
  let joinCodeDraft = '';
  let pendingSlot = null;

  let seenEventRound = null;
  let seenSituationSig = undefined;
  let lastKnownStatus = null;
  let autoFinalizeInFlight = false;
  let lastSeenChatCount = -1; // -1 = ещё не рендерили чат в этой сессии (не проигрывать анимацию на всю историю)
  let flippedCardIds = new Set(); // id карточек игроков, развёрнутых лицом с характеристиками (переживает поллинг)

  const appEl = document.getElementById('app');
  let toastContainer = null;
  let langSwitcherEl = null;

  // ---------------------------------------------------------------------
  // Инициализация
  // ---------------------------------------------------------------------

  function init() {
    ensureToastContainer();
    ensureLangSwitcher();
    ensureSoundSwitcher();
    ensureAmbientParticles();
    attachGlobalRipple();

    const params = new URLSearchParams(location.search);
    const roomFromUrl = (params.get('room') || '').toUpperCase().trim();

    if (session && session.code) {
      startPolling();
    } else if (roomFromUrl) {
      homeScreen = 'play';
      joinCodeDraft = roomFromUrl;
      renderHome();
      maybeShowFirstVisitHowTo();
    } else {
      renderHome();
      maybeShowFirstVisitHowTo();
    }

    if (!tickHandle) {
      tickHandle = setInterval(tick, 250);
    }

    setTimeout(() => {
      const loader = document.getElementById('loading-screen');
      if (loader) loader.classList.add('hidden');
    }, 500);
  }

  function ensureToastContainer() {
    toastContainer = document.getElementById('global-toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'toast-container';
      toastContainer.id = 'global-toast-container';
      document.body.appendChild(toastContainer);
    }
  }

  // ---------------------------------------------------------------------
  // Переключатель языка интерфейса — фиксированная кнопка вне #app,
  // чтобы оставаться на экране при любых перерисовках (innerHTML #app
  // не затрагивает элементы, добавленные напрямую в <body>).
  // ---------------------------------------------------------------------

  function ensureLangSwitcher() {
    langSwitcherEl = document.getElementById('lang-switcher-btn');
    if (!langSwitcherEl) {
      langSwitcherEl = document.createElement('button');
      langSwitcherEl.id = 'lang-switcher-btn';
      langSwitcherEl.className = 'lang-switcher-btn';
      langSwitcherEl.type = 'button';
      langSwitcherEl.addEventListener('click', () => setLang(lang === 'ru' ? 'en' : 'ru'));
      document.body.appendChild(langSwitcherEl);
    }
    updateLangSwitcherUI();
  }

  function updateLangSwitcherUI() {
    if (!langSwitcherEl) return;
    langSwitcherEl.title = t('lang_switch_title');
    langSwitcherEl.innerHTML = lang === 'ru'
      ? '<span class="lang-code active">RU</span><span class="lang-sep">/</span><span class="lang-code">EN</span>'
      : '<span class="lang-code">RU</span><span class="lang-sep">/</span><span class="lang-code active">EN</span>';
  }

  // ---------------------------------------------------------------------
  // Сессия (localStorage: только код комнаты + токен игрока)
  // ---------------------------------------------------------------------

  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.code) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function setSession(code, token) {
    session = { code: (code || '').toUpperCase(), token: token || null };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) { /* ignore */ }
  }

  function clearSession() {
    session = null;
    try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
  }

  function getDefaultName() {
    try { return localStorage.getItem(DEFAULT_NAME_KEY) || ''; } catch (e) { return ''; }
  }

  function setDefaultName(name) {
    try {
      if (name) localStorage.setItem(DEFAULT_NAME_KEY, name);
      else localStorage.removeItem(DEFAULT_NAME_KEY);
    } catch (e) { /* ignore */ }
  }

  // ---------------------------------------------------------------------
  // API helper
  // ---------------------------------------------------------------------

  async function api(method, path, body) {
    const headers = {};
    if (session && session.token) headers['X-Player-Token'] = session.token;
    const res = await axios({ method, url: API_BASE + path, data: body, headers });
    return res.data;
  }

  function errorMessageFrom(e) {
    const code = e && e.response && e.response.data && e.response.data.error;
    return t('err_' + code) !== ('err_' + code) ? t('err_' + code) : t('err_generic');
  }

  // ---------------------------------------------------------------------
  // Поллинг состояния комнаты
  // ---------------------------------------------------------------------

  function stopPolling() {
    if (pollHandle) { clearInterval(pollHandle); pollHandle = null; }
  }

  function startPolling() {
    stopPolling();
    pollOnce();
    pollHandle = setInterval(pollOnce, POLL_INTERVAL);
  }

  async function pollOnce() {
    if (!session || !session.code) return;
    try {
      const data = await api('get', `/${session.code}/state`);
      lastData = data;
      render();
    } catch (e) {
      const code = e && e.response && e.response.data && e.response.data.error;
      if (code === 'room_not_found') {
        showToast(t('toast_room_gone_title'), t('toast_room_gone_msg'), 'fa-triangle-exclamation');
        clearSession();
        stopPolling();
        lastData = null;
        currentView = null;
        renderHome();
      }
      // прочие ошибки — временный сбой сети, просто ждём следующий тик
    }
  }

  // ---------------------------------------------------------------------
  // Сохранение значений полей ввода при полной перерисовке (чтобы не терять фокус/текст)
  // ---------------------------------------------------------------------

  function preserveInputs(ids) {
    const out = {};
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        out[id] = {
          value: el.value,
          focused: document.activeElement === el,
          selStart: el.selectionStart,
          selEnd: el.selectionEnd,
        };
      }
    });
    return out;
  }

  function restoreInputs(vals) {
    Object.entries(vals).forEach(([id, v]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = v.value;
      if (v.focused) {
        el.focus();
        try { el.setSelectionRange(v.selStart, v.selEnd); } catch (e) { /* ignore */ }
      }
    });
  }

  function captureChatScroll() {
    const el = document.getElementById('chat-messages');
    if (!el) return null;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    return { atBottom, scrollTop: el.scrollTop };
  }

  function restoreChatScroll(saved) {
    const el = document.getElementById('chat-messages');
    if (!el) return;
    if (!saved || saved.atBottom) {
      el.scrollTop = el.scrollHeight;
    } else {
      el.scrollTop = saved.scrollTop;
    }
  }

  // ---------------------------------------------------------------------
  // Главный рендер-диспетчер
  // ---------------------------------------------------------------------

  function computeView(data) {
    if (!session || !session.token) return 'seat-select';
    if (!data || !data.room) return 'seat-select';
    if (data.room.status === 'ended') return 'victory';
    if (data.room.status === 'catastrophe') return 'catastrophe';
    if (data.room.status === 'game') return 'game';
    return 'lobby';
  }

  function render() {
    const data = lastData;
    const view = data ? computeView(data) : 'home';
    const isViewChange = view !== currentView; // true только при переходе между экранами, не при фоновом поллинге

    if (data && data.room && data.room.status !== lastKnownStatus) {
      if (data.room.status === 'catastrophe') {
        seenEventRound = 0;
        seenSituationSig = null;
      }
      lastKnownStatus = data.room.status;
    }

    currentView = view;

    const preserved = preserveInputs(['seat-name-input', 'chat-input', 'join-code-input', 'discussion-seconds-input', 'voting-seconds-input']);
    const chatScroll = captureChatScroll();

    if (view === 'seat-select') renderSeatSelect(data);
    else if (view === 'lobby') renderLobby(data);
    else if (view === 'catastrophe') renderCatastrophe(data);
    else if (view === 'game') renderGame(data);
    else if (view === 'victory') renderVictory(data);
    else renderHome();

    // Анимацию появления экрана проигрываем только при реальном переходе между экранами
    // (например, лобби -> катастрофа), а не при каждом фоновом обновлении данных того же
    // экрана поллингом раз в 2.5 сек — иначе экран будет заметно "мигать".
    if (isViewChange) {
      const screenEl = appEl.querySelector('.screen, .catastrophe-screen');
      if (screenEl) screenEl.classList.add('view-enter');

      if (view === 'game') {
        const grid = document.getElementById('players-grid');
        if (grid) {
          grid.classList.add('stagger-in');
          Array.from(grid.querySelectorAll('.player-card-flip')).forEach((card, i) => {
            card.style.setProperty('--stg', (i * 70) + 'ms');
          });
        }
      }

      if (view === 'victory') {
        spawnConfetti();
        playSfx('victory');
      }

      if (view === 'catastrophe') {
        playSfx('alarm');
      }
    }

    restoreInputs(preserved);
    restoreChatScroll(chatScroll);

    if (data) checkAutoModals(data);
  }

  function tick() {
    document.querySelectorAll('[data-ends-at]').forEach((el) => {
      const endsAt = Number(el.dataset.endsAt);
      const remain = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      el.textContent = formatCountdown(remain);
      el.classList.toggle('urgent', remain <= 15 && remain > 0);
      el.classList.toggle('expired', remain <= 0);
      const pill = el.closest('.timer-pill');
      if (pill) pill.classList.toggle('urgent-pill', remain <= 15 && remain > 0);
      // Тикающий звук последних секунд — только один раз на каждую целую секунду 5..1,
      // а не на каждый вызов tick() (тик идёт каждые 250мс).
      if (remain > 0 && remain <= 5) {
        const lastPlayed = Number(el.dataset.lastTickSec || -1);
        if (lastPlayed !== remain) {
          el.dataset.lastTickSec = String(remain);
          playSfx('timerTick');
        }
      }
    });
    maybeAutoFinalizeVote();
  }

  function formatCountdown(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  async function maybeAutoFinalizeVote() {
    if (!lastData || !lastData.voting || lastData.voting.status !== 'active') return;
    if (!lastData.room || !lastData.me) return;
    if (lastData.me.id !== lastData.room.hostPlayerId) return;
    if (Number(lastData.voting.endsAt) > Date.now()) return;
    if (autoFinalizeInFlight) return;
    autoFinalizeInFlight = true;
    try {
      await api('post', `/${session.code}/vote/finalize`, {});
      await pollOnce();
    } catch (e) { /* ignore */ } finally {
      autoFinalizeInFlight = false;
    }
  }

  // ---------------------------------------------------------------------
  // ГЛАВНАЯ (создание / вход в комнату)
  // ---------------------------------------------------------------------

  function renderHome() {
    if (homeScreen === 'play') renderPlayScreen();
    else if (homeScreen === 'settings') renderSettingsScreen();
    else renderLandingScreen();
  }

  // --- Атмосферный декоративный фон для «сцен» (катастрофа / победа / бункер) ---
  // Полностью статичный (без бесконечных CSS-анимаций), чтобы не вызывать
  // повторное "мигание" при перерисовке во время поллинга раз в 2.5с —
  // единственный визуальный эффект появления навешивается через класс
  // .view-enter на корневой элемент экрана (см. render()), который
  // добавляется только при реальном переходе между экранами.
  function sceneBackdropHtml(theme) {
    return `
      <div class="scene-backdrop theme-${theme}" aria-hidden="true">
        <div class="scene-glow"></div>
        <div class="scene-grid"></div>
        <span class="scene-dot" style="top:14%;left:10%;"></span>
        <span class="scene-dot" style="top:22%;left:82%;"></span>
        <span class="scene-dot" style="top:68%;left:6%;"></span>
        <span class="scene-dot" style="top:78%;left:90%;"></span>
        <span class="scene-dot" style="top:45%;left:94%;"></span>
        <span class="scene-dot" style="top:52%;left:3%;"></span>
      </div>
    `;
  }

  // --- Общий блок «Правила игры» (используется в лобби, настройках и подсказке) ---

  function fullRulesGridHtml() {
    return `
      <div class="rules-grid">
        <div class="rule-item"><i class="fa-solid fa-1"></i><div>
          <div class="rule-h">${t('rule1_h')}</div>
          <div class="rule-t">${t('rule1_t')}</div>
        </div></div>
        <div class="rule-item"><i class="fa-solid fa-2"></i><div>
          <div class="rule-h">${t('rule2_h')}</div>
          <div class="rule-t">${t('rule2_t')}</div>
        </div></div>
        <div class="rule-item"><i class="fa-solid fa-3"></i><div>
          <div class="rule-h">${t('rule3_h')}</div>
          <div class="rule-t">${t('rule3_t')}</div>
        </div></div>
        <div class="rule-item"><i class="fa-solid fa-4"></i><div>
          <div class="rule-h">${t('rule4_h')}</div>
          <div class="rule-t">${t('rule4_t')}</div>
        </div></div>
        <div class="rule-item"><i class="fa-solid fa-5"></i><div>
          <div class="rule-h">${t('rule5_h')}</div>
          <div class="rule-t">${t('rule5_t')}</div>
        </div></div>
        <div class="rule-item"><i class="fa-solid fa-6"></i><div>
          <div class="rule-h">${t('rule6_h')}</div>
          <div class="rule-t">${t('rule6_t')}</div>
        </div></div>
      </div>
    `;
  }

  function showRulesModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="panel modal-box rules-modal-box">
        <div class="rules-title"><i class="fa-solid fa-book-open"></i> ${t('rules_modal_title')}</div>
        ${fullRulesGridHtml()}
        <div class="modal-actions" style="margin-top:18px;">
          <button class="btn btn-primary" id="rules-modal-close-btn"><i class="fa-solid fa-check"></i> ${t('btn_understood')}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('rules-modal-close-btn').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  }

  // --- СТРАНИЦА 1: лендинг / главное меню ---------------------------------

  function renderLandingScreen() {
    currentView = 'home';
    appEl.innerHTML = `
      <div class="screen mp-home-screen landing-screen view-enter">
        ${sceneBackdropHtml('bunker')}
        <div class="container landing-container">
          <div class="landing-emblem">
            <div class="landing-emblem-ring"></div>
            <div class="landing-emblem-ring landing-emblem-ring-2"></div>
            <i class="fa-solid fa-radiation"></i>
          </div>

          <div class="top-title">
            <h1>SHELTER</h1>
          </div>
          <div class="subtitle">${t('landing_subtitle')}</div>

          <div class="landing-badges">
            <div class="landing-badge"><i class="fa-solid fa-users"></i> ${t('landing_badge_players')}</div>
            <div class="landing-badge"><i class="fa-solid fa-mobile-screen-button"></i> ${t('landing_badge_devices')}</div>
            <div class="landing-badge"><i class="fa-solid fa-bolt"></i> ${t('landing_badge_fast')}</div>
          </div>

          <div class="landing-actions landing-actions-center">
            <button class="btn btn-primary btn-lg btn-shine" id="landing-play-btn"><i class="fa-solid fa-play"></i> ${t('btn_play')}</button>
            <div class="landing-actions-row">
              <button class="btn btn-secondary" id="landing-howto-btn"><i class="fa-solid fa-circle-question"></i> ${t('btn_howto')}</button>
              <button class="btn btn-secondary" id="landing-settings-btn"><i class="fa-solid fa-gear"></i> ${t('btn_settings')}</button>
            </div>
            <button class="btn btn-ghost landing-telegram-btn" id="landing-support-btn"><i class="fa-brands fa-telegram"></i> ${t('btn_telegram')}</button>
          </div>

          <div class="app-footer">${t('footer_copyright')}</div>
        </div>
      </div>
    `;

    document.getElementById('landing-play-btn').addEventListener('click', () => { homeScreen = 'play'; renderHome(); });
    document.getElementById('landing-howto-btn').addEventListener('click', showHowToModal);
    document.getElementById('landing-settings-btn').addEventListener('click', () => { homeScreen = 'settings'; renderHome(); });
    document.getElementById('landing-support-btn').addEventListener('click', () => {
      window.open(TELEGRAM_CHANNEL_URL, '_blank', 'noopener');
    });
  }

  function howToGridHtml() {
    return `
      <div class="rules-grid rules-grid-single">
        <div class="rule-item"><i class="fa-solid fa-1"></i><div>
          <div class="rule-h">${t('howto1_h')}</div>
          <div class="rule-t">${t('howto1_t')}</div>
        </div></div>
        <div class="rule-item"><i class="fa-solid fa-2"></i><div>
          <div class="rule-h">${t('howto2_h')}</div>
          <div class="rule-t">${t('howto2_t')}</div>
        </div></div>
        <div class="rule-item"><i class="fa-solid fa-3"></i><div>
          <div class="rule-h">${t('howto3_h')}</div>
          <div class="rule-t">${t('howto3_t')}</div>
        </div></div>
        <div class="rule-item"><i class="fa-solid fa-4"></i><div>
          <div class="rule-h">${t('howto4_h')}</div>
          <div class="rule-t">${t('howto4_t')}</div>
        </div></div>
        <div class="rule-item"><i class="fa-solid fa-5"></i><div>
          <div class="rule-h">${t('howto5_h')}</div>
          <div class="rule-t">${t('howto5_t')}</div>
        </div></div>
        <div class="rule-item"><i class="fa-solid fa-6"></i><div>
          <div class="rule-h">${t('howto6_h')}</div>
          <div class="rule-t">${t('howto6_t')}</div>
        </div></div>
      </div>
    `;
  }

  function showHowToModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="panel modal-box rules-modal-box">
        <div class="stamp-corner">${t('stamp_secret')}</div>
        <div class="rules-title"><i class="fa-solid fa-circle-question"></i> ${t('howto_modal_title')}</div>
        ${howToGridHtml()}
        <div class="modal-actions" style="margin-top:18px;">
          <button class="btn btn-primary" id="howto-modal-close-btn"><i class="fa-solid fa-check"></i> ${t('btn_understood')}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('howto-modal-close-btn').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  }

  // --- СТРАНИЦА 2: играть (создать комнату / войти по коду) ---------------

  function renderPlayScreen() {
    currentView = 'home';
    appEl.innerHTML = `
      <div class="screen mp-home-screen view-enter">
        <div class="container">
          <button class="btn btn-ghost back-btn" id="play-back-btn"><i class="fa-solid fa-arrow-left"></i> ${t('btn_back')}</button>
          <div class="top-title">
            <i class="fa-solid fa-radiation"></i>
            <h1>${t('play_title')}</h1>
          </div>
          <div class="subtitle">${t('play_subtitle')}</div>

          <div class="play-layout">
            <div class="panel mp-panel play-panel">
              ${createPanelHtml()}
            </div>

            <div class="play-divider"><span>${t('divider_or')}</span></div>

            <div class="panel mp-panel play-panel">
              ${joinPanelHtml()}
            </div>
          </div>

          <div class="app-footer">${t('footer_copyright')}</div>
        </div>
      </div>
    `;

    document.getElementById('play-back-btn').addEventListener('click', () => { homeScreen = 'landing'; renderHome(); });

    const slider = document.getElementById('create-count-slider');
    const countVal = document.getElementById('create-count-val');
    slider.addEventListener('input', () => {
      countVal.textContent = slider.value;
      createCount = Number(slider.value);
    });
    document.getElementById('create-room-btn').addEventListener('click', handleCreateRoom);

    const input = document.getElementById('join-code-input');
    input.addEventListener('input', () => {
      joinCodeDraft = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
      input.value = joinCodeDraft;
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleJoinByCode(); });
    document.getElementById('join-room-btn').addEventListener('click', handleJoinByCode);
  }

  // --- СТРАНИЦА 3: настройки (заглушка) ------------------------------------

  function renderSettingsScreen() {
    currentView = 'home';
    const savedName = getDefaultName();
    appEl.innerHTML = `
      <div class="screen mp-home-screen view-enter">
        <div class="container">
          <button class="btn btn-ghost back-btn" id="settings-back-btn"><i class="fa-solid fa-arrow-left"></i> ${t('btn_back')}</button>
          <div class="top-title">
            <i class="fa-solid fa-gear"></i>
            <h1>${t('settings_title')}</h1>
          </div>

          <div class="settings-layout">
            <div class="panel mp-panel settings-section">
              <div class="rules-title"><i class="fa-solid fa-id-badge"></i> ${t('settings_default_name_title')}</div>
              <div class="setup-hint" style="margin-top:0;margin-bottom:14px;">${t('settings_default_name_hint')}</div>
              <div class="setup-field">
                <input type="text" id="default-name-input" class="name-input-lg" placeholder="${t('settings_name_placeholder')}" maxlength="24" autocomplete="off" value="${escapeHtml(savedName)}" />
              </div>
              <div class="setup-actions" style="margin-top:16px;">
                <button class="btn btn-primary" id="default-name-save-btn"><i class="fa-solid fa-floppy-disk"></i> ${t('settings_save_btn')}</button>
              </div>
            </div>

            <div class="panel rules-panel settings-section">
              <div class="rules-title"><i class="fa-solid fa-book-open"></i> ${t('settings_rules_title')}</div>
              ${fullRulesGridHtml()}
            </div>

            <div class="panel mp-panel settings-section">
              <div class="rules-title"><i class="fa-solid fa-circle-info"></i> ${t('settings_about_title')}</div>
              <div class="about-text">
                <p>${t('settings_about_p1')}</p>
                <p>${t('settings_about_p2')}</p>
                <p>${t('settings_about_p3')}</p>
              </div>
              <div class="setup-actions" style="margin-top:20px;">
                <button class="btn btn-secondary" id="settings-support-btn"><i class="fa-brands fa-telegram"></i> ${t('btn_telegram')}</button>
              </div>
            </div>
          </div>

          <div class="app-footer">${t('footer_copyright')}</div>
        </div>
      </div>
    `;

    const back = () => { homeScreen = 'landing'; renderHome(); };
    document.getElementById('settings-back-btn').addEventListener('click', back);

    document.getElementById('default-name-save-btn').addEventListener('click', () => {
      const input = document.getElementById('default-name-input');
      const name = (input.value || '').trim().slice(0, 24);
      setDefaultName(name);
      showToast(t('toast_saved_title'), name ? t('toast_saved_name', { name: escapeHtml(name) }) : t('toast_saved_cleared'), 'fa-floppy-disk');
    });

    document.getElementById('settings-support-btn').addEventListener('click', () => {
      window.open(TELEGRAM_CHANNEL_URL, '_blank', 'noopener');
    });
  }

  function createPanelHtml() {
    return `
      <div class="stamp-corner">${t('stamp_secret')}</div>
      <div class="rules-title"><i class="fa-solid fa-plus"></i> ${t('create_title')}</div>
      <div class="setup-field">
        <label>${t('create_count_label')} <span class="val" id="create-count-val">${createCount}</span></label>
        <input type="range" id="create-count-slider" min="4" max="16" step="1" value="${createCount}" />
        <div class="setup-hint">${t('create_count_hint')}</div>
      </div>
      <div class="setup-field">
        <label>${t('create_howitworks_label')}</label>
        <div class="setup-hint">
          ${t('create_howitworks_html')}
        </div>
      </div>
      <div class="setup-actions">
        <button class="btn btn-primary" id="create-room-btn"><i class="fa-solid fa-door-open"></i> ${t('create_btn')}</button>
      </div>
    `;
  }

  function joinPanelHtml() {
    return `
      <div class="rules-title"><i class="fa-solid fa-right-to-bracket"></i> ${t('join_title')}</div>
      <div class="setup-field" style="text-align:center;">
        <label>${t('join_code_label')}</label>
        <input type="text" id="join-code-input" class="room-code-input" placeholder="XXXXX" maxlength="5" value="${escapeHtml(joinCodeDraft)}" autocomplete="off" autocapitalize="characters" />
        <div class="setup-hint">${t('join_code_hint')}</div>
      </div>
      <div class="setup-actions">
        <button class="btn btn-primary" id="join-room-btn"><i class="fa-solid fa-right-to-bracket"></i> ${t('join_btn')}</button>
      </div>
    `;
  }

  async function handleCreateRoom() {
    const btn = document.getElementById('create-room-btn');
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${t('create_btn_loading')}`;
    try {
      const res = await api('post', '/create', { playerCount: createCount });
      seenEventRound = null;
      seenSituationSig = undefined;
      lastKnownStatus = null;
      setSession(res.code, null);
      startPolling();
    } catch (e) {
      showToast(t('toast_error_title'), errorMessageFrom(e), 'fa-triangle-exclamation');
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-door-open"></i> ${t('create_btn')}`;
    }
  }

  function handleJoinByCode() {
    const code = (joinCodeDraft || '').toUpperCase().trim();
    if (code.length !== 5) {
      showToast(t('toast_invalid_code_title'), t('toast_invalid_code_msg'), 'fa-triangle-exclamation');
      return;
    }
    seenEventRound = null;
    seenSituationSig = undefined;
    lastKnownStatus = null;
    setSession(code, null);
    startPolling();
  }

  // ---------------------------------------------------------------------
  // ВЫБОР МЕСТА (до получения токена)
  // ---------------------------------------------------------------------

  function renderSeatSelect(data) {
    if (!data || !data.room) {
      appEl.innerHTML = `
        <div class="screen" style="display:flex;align-items:center;justify-content:center;">
          <div class="container" style="text-align:center;">
            <i class="fa-solid fa-spinner fa-spin" style="font-size:32px;color:var(--rust-light);"></i>
            <p class="setup-hint" style="margin-top:16px;">${t('seat_connecting', { code: escapeHtml(session ? session.code : '') })}</p>
          </div>
        </div>
      `;
      return;
    }

    const room = data.room;
    const players = data.players || [];
    const gameStarted = room.status !== 'lobby';

    appEl.innerHTML = `
      <div class="screen">
        <div class="container">
          <div class="top-title">
            <i class="fa-solid fa-people-roof"></i>
            <h1>${t('room_title')}</h1>
          </div>
          ${roomCodeBadgeHtml(room.code)}
          <div class="subtitle">${t('seat_choose_subtitle')}<span class="divider"></span>${t('seat_occupied', { claimed: players.filter(p => p.claimed).length, total: players.length })}</div>

          ${gameStarted ? `
            <div class="panel mp-panel" style="text-align:center;">
              <i class="fa-solid fa-hourglass-half" style="font-size:32px;color:var(--warning);margin-bottom:14px;"></i>
              <p>${t('seat_game_started_msg')}</p>
              <button class="btn btn-secondary" id="seat-back-btn"><i class="fa-solid fa-arrow-left"></i> ${t('btn_back')}</button>
            </div>
          ` : `
            <div class="panel mp-panel">
              <div class="seat-grid" id="seat-grid">
                ${players.map((p) => seatCellHtml(p, { hostId: room.hostPlayerId, clickable: true })).join('')}
              </div>
            </div>
            <div class="panel name-claim-panel ${pendingSlot ? '' : 'hidden'}" id="name-claim-panel">
              ${pendingSlot ? `
                <div class="rules-title" style="margin-bottom:14px;"><i class="fa-solid fa-user-pen"></i> ${t('seat_slot_label', { slot: pendingSlot })}</div>
                <input type="text" id="seat-name-input" class="name-input-lg" placeholder="${t('seat_name_placeholder')}" maxlength="24" autocomplete="off" value="${escapeHtml(getDefaultName())}" />
                <div class="modal-actions" style="margin-top:16px;">
                  <button class="btn btn-secondary" id="seat-cancel-btn">${t('btn_cancel')}</button>
                  <button class="btn btn-primary" id="seat-confirm-btn"><i class="fa-solid fa-check"></i> ${t('seat_confirm_btn')}</button>
                </div>
              ` : ''}
            </div>
          `}

          <div class="setup-actions" style="margin-top:20px;">
            <button class="btn btn-ghost" id="leave-home-btn"><i class="fa-solid fa-arrow-left"></i> ${t('seat_leave_btn')}</button>
          </div>

          <div class="app-footer">${t('footer_copyright_board')}</div>
        </div>
      </div>
    `;

    attachRoomCodeCopy();

    const backBtn = document.getElementById('seat-back-btn');
    if (backBtn) backBtn.addEventListener('click', handleLeaveToHome);

    document.getElementById('leave-home-btn').addEventListener('click', handleLeaveToHome);

    if (!gameStarted) {
      document.querySelectorAll('#seat-grid .seat-cell.empty').forEach((cell) => {
        cell.addEventListener('click', () => {
          pendingSlot = Number(cell.dataset.slot);
          render();
          setTimeout(() => {
            const input = document.getElementById('seat-name-input');
            if (input) input.focus();
          }, 30);
        });
      });

      const cancelBtn = document.getElementById('seat-cancel-btn');
      if (cancelBtn) cancelBtn.addEventListener('click', () => { pendingSlot = null; render(); });

      const confirmBtn = document.getElementById('seat-confirm-btn');
      if (confirmBtn) confirmBtn.addEventListener('click', handleClaimSeat);

      const nameInput = document.getElementById('seat-name-input');
      if (nameInput) nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleClaimSeat(); });
    }
  }

  async function handleClaimSeat() {
    const input = document.getElementById('seat-name-input');
    const name = (input ? input.value : '').trim().slice(0, 24);
    if (!name) {
      showToast(t('toast_enter_name_title'), t('toast_enter_name_msg'), 'fa-triangle-exclamation');
      return;
    }
    const btn = document.getElementById('seat-confirm-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${t('seat_claiming_btn')}`; }
    try {
      const res = await api('post', `/${session.code}/join`, { slot: pendingSlot, name });
      setSession(session.code, res.token);
      setDefaultName(name);
      pendingSlot = null;
      lastData = res;
      render();
      showToast(t('toast_welcome_title'), t('toast_welcome_msg', { slot: res.me ? res.me.slot : '', name: escapeHtml(name) }), 'fa-user-check');
    } catch (e) {
      showToast(t('toast_seat_fail_title'), errorMessageFrom(e), 'fa-triangle-exclamation');
      pendingSlot = null;
      render();
    }
  }

  function handleLeaveToHome() {
    clearSession();
    stopPolling();
    lastData = null;
    currentView = null;
    pendingSlot = null;
    lastSeenChatCount = -1;
    seenEventRound = null;
    seenSituationSig = undefined;
    lastKnownStatus = null;
    gameHintDismissed = false;
    homeScreen = 'landing';
    renderHome();
  }

  function seatCellHtml(p, ctx) {
    const isHostSeat = ctx.hostId && p.id === ctx.hostId;
    if (!p.claimed) {
      return `<div class="seat-cell empty" data-slot="${p.slot}">
        <span class="seat-light"></span>
        <div class="seat-num">${p.slot}</div>
        <div class="seat-state"><i class="fa-solid fa-user-plus"></i> ${t('seat_free')}</div>
      </div>`;
    }
    return `<div class="seat-cell taken ${p.isMe ? 'mine' : ''} ${p.excluded ? 'excluded' : ''}" data-slot="${p.slot}">
      <span class="seat-light"></span>
      <div class="seat-num">${p.slot}</div>
      <div class="seat-name">${escapeHtml(p.name)}</div>
      <div class="seat-badges">
        ${p.isMe ? `<span class="me-badge">${t('seat_me_badge')}</span>` : ''}
        ${isHostSeat ? `<span class="host-badge" title="${t('seat_host_title')}"><i class="fa-solid fa-crown"></i></span>` : ''}
        ${p.excluded ? `<span class="excluded-badge" title="${t('seat_excluded_title')}"><i class="fa-solid fa-user-slash"></i></span>` : ''}
      </div>
    </div>`;
  }

  function roomCodeBadgeHtml(code) {
    return `
      <div class="room-code-badge">
        <span>${t('room_code_label')}</span>
        <span class="code-text">${escapeHtml(code)}</span>
        <button class="copy-code-btn" id="copy-code-btn" title="${t('copy_code_title')}"><i class="fa-solid fa-copy"></i></button>
      </div>
    `;
  }

  function attachRoomCodeCopy() {
    const btn = document.getElementById('copy-code-btn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const code = session ? session.code : '';
      const url = `${location.origin}${location.pathname}?room=${code}`;
      try {
        await navigator.clipboard.writeText(url);
        showToast(t('toast_copied_title'), t('toast_copied_msg'), 'fa-copy');
      } catch (e) {
        showToast(t('toast_room_code_title'), code, 'fa-copy');
      }
    });
  }

  // ---------------------------------------------------------------------
  // ЛОББИ (уже занял место, ожидание старта игры)
  // ---------------------------------------------------------------------

  function renderLobby(data) {
    const room = data.room;
    const players = data.players || [];
    const me = data.me;
    const isHost = !!(me && room.hostPlayerId === me.id);
    const claimedCount = players.filter((p) => p.claimed).length;
    const hostPlayer = players.find((p) => p.id === room.hostPlayerId);
    const hostSuffix = hostPlayer ? ' (' + escapeHtml(hostPlayer.name) + ')' : '';

    appEl.innerHTML = `
      <div class="screen">
        <div class="container">
          <div class="top-title">
            <i class="fa-solid fa-people-roof"></i>
            <h1>${t('lobby_title')}</h1>
          </div>
          ${roomCodeBadgeHtml(room.code)}
          <div class="subtitle">${t('lobby_subtitle')}<span class="divider"></span>${t('lobby_players_divider', { claimed: claimedCount, total: players.length })}</div>

          <div class="panel rules-panel">
            <div class="rules-title"><i class="fa-solid fa-book-open"></i> ${t('rules_modal_title')}</div>
            ${fullRulesGridHtml()}
          </div>

          <div class="panel mp-panel bunker-scene-panel">
            ${sceneBackdropHtml('bunker')}
            <div class="rules-title"><i class="fa-solid fa-signature"></i> ${t('lobby_bunker_slots_title')}</div>
            <div class="seat-grid" id="seat-grid">
              ${players.map((p) => seatCellHtml(p, { hostId: room.hostPlayerId, clickable: false })).join('')}
            </div>
          </div>

          <div class="catastrophe-actions">
            ${isHost ? `
              <button class="btn btn-primary" id="lobby-start-btn" ${claimedCount < 2 ? 'disabled' : ''}>
                <i class="fa-solid fa-door-closed"></i> ${t('lobby_start_btn')}
              </button>
              ${claimedCount < 2 ? `<div class="setup-hint">${t('lobby_min_players_hint')}</div>` : ''}
            ` : `
              <div class="setup-hint"><i class="fa-solid fa-hourglass-half"></i> ${t('lobby_waiting_host', { host: hostSuffix })}</div>
            `}
          </div>

          <div class="setup-actions">
            <button class="btn btn-ghost" id="leave-home-btn"><i class="fa-solid fa-arrow-right-from-bracket"></i> ${t('lobby_leave_btn')}</button>
          </div>

          <div class="app-footer">${t('footer_copyright_board')}</div>
        </div>
      </div>
    `;

    attachRoomCodeCopy();
    document.getElementById('leave-home-btn').addEventListener('click', handleLeaveToHome);

    const startBtn = document.getElementById('lobby-start-btn');
    if (startBtn) startBtn.addEventListener('click', handleStartGame);
  }

  async function handleStartGame() {
    const btn = document.getElementById('lobby-start-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${t('lobby_starting_btn')}`; }
    try {
      await api('post', `/${session.code}/start`, {});
      await pollOnce();
    } catch (e) {
      showToast(t('toast_error_title'), errorMessageFrom(e), 'fa-triangle-exclamation');
      render();
    }
  }

  // ---------------------------------------------------------------------
  // КАТАСТРОФА
  // ---------------------------------------------------------------------

  function renderCatastrophe(data) {
    const room = data.room;
    const me = data.me;
    const isHost = !!(me && room.hostPlayerId === me.id);
    const catastrophe = room.catastrophe || { icon: 'fa-radiation', title: '...', description: '' };
    const bunker = room.bunker || {};

    appEl.innerHTML = `
      <div class="catastrophe-screen">
        ${sceneBackdropHtml('danger')}
        <div class="catastrophe-alert"><i class="fa-solid fa-triangle-exclamation"></i> ${t('catastrophe_alert')} <i class="fa-solid fa-triangle-exclamation"></i></div>
        <div class="panel catastrophe-card">
          ${roomCodeBadgeHtml(room.code)}
          <i class="fa-solid ${catastrophe.icon} catastrophe-icon"></i>
          <h2 class="catastrophe-title">${escapeHtml(tc(catastrophe.title))}</h2>
          <p class="catastrophe-desc">${escapeHtml(tc(catastrophe.description || ''))}</p>

          <div class="bunker-params">
            <div class="bunker-param"><div class="label"><i class="fa-solid fa-ruler-combined"></i>${t('label_size')}</div><div class="value">${escapeHtml(tc(bunker.size || ''))}</div></div>
            <div class="bunker-param"><div class="label"><i class="fa-solid fa-hourglass-half"></i>${t('label_duration')}</div><div class="value">${escapeHtml(tc(bunker.duration || ''))}</div></div>
            <div class="bunker-param"><div class="label"><i class="fa-solid fa-layer-group"></i>${t('label_floors')}</div><div class="value">${escapeHtml(tc(bunker.floors || ''))}</div></div>
            <div class="bunker-param"><div class="label"><i class="fa-solid fa-door-open"></i>${t('label_extra_room')}</div><div class="value">${escapeHtml(tc(bunker.extraRoom || ''))}</div></div>
            <div class="bunker-param"><div class="label"><i class="fa-solid fa-drumstick-bite"></i>${t('label_food')}</div><div class="value">${escapeHtml(tc(bunker.foodSupply || ''))}</div></div>
            <div class="bunker-param bunker-param-capacity"><div class="label"><i class="fa-solid fa-people-roof"></i>${t('label_capacity')}</div><div class="value">${bunker.capacity ? t('capacity_person_suffix', { n: bunker.capacity }) : '—'}</div></div>
          </div>
          ${bunker.capacity ? `<div class="setup-hint capacity-hint"><i class="fa-solid fa-circle-exclamation"></i> ${t('capacity_hint', { capacity: bunker.capacity })}</div>` : ''}

          <div class="catastrophe-actions">
            ${isHost ? `
              <button class="btn btn-secondary" id="reroll-catastrophe"><i class="fa-solid fa-rotate"></i> ${t('btn_reroll_catastrophe')}</button>
              <button class="btn btn-secondary" id="reroll-bunker"><i class="fa-solid fa-rotate"></i> ${t('btn_reroll_bunker')}</button>
              <button class="btn btn-primary" id="enter-bunker"><i class="fa-solid fa-people-group"></i> ${t('btn_enter_bunker')}</button>
            ` : `
              <div class="setup-hint"><i class="fa-solid fa-hourglass-half"></i> ${t('catastrophe_waiting_host')}</div>
            `}
          </div>
        </div>
        <div class="app-footer">${t('footer_copyright_board')}</div>
      </div>
    `;

    attachRoomCodeCopy();

    const rerollC = document.getElementById('reroll-catastrophe');
    if (rerollC) rerollC.addEventListener('click', async () => {
      try { await api('post', `/${session.code}/reroll-catastrophe`, {}); await pollOnce(); }
      catch (e) { showToast(t('toast_error_title'), errorMessageFrom(e), 'fa-triangle-exclamation'); }
    });

    const rerollB = document.getElementById('reroll-bunker');
    if (rerollB) rerollB.addEventListener('click', async () => {
      try { await api('post', `/${session.code}/reroll-bunker`, {}); await pollOnce(); }
      catch (e) { showToast(t('toast_error_title'), errorMessageFrom(e), 'fa-triangle-exclamation'); }
    });

    const enterBtn = document.getElementById('enter-bunker');
    if (enterBtn) enterBtn.addEventListener('click', async () => {
      try { await api('post', `/${session.code}/enter-bunker`, {}); await pollOnce(); }
      catch (e) { showToast(t('toast_error_title'), errorMessageFrom(e), 'fa-triangle-exclamation'); }
    });
  }

  // ---------------------------------------------------------------------
  // ИГРА (основной экран)
  // ---------------------------------------------------------------------

  function renderGame(data) {
    const room = data.room;
    const players = data.players || [];
    const me = data.me;
    const isHost = !!(me && room.hostPlayerId === me.id);
    const aliveCount = players.filter((p) => !p.excluded && p.claimed).length;
    const totalCount = players.filter((p) => p.claimed).length || players.length;
    const pct = totalCount ? Math.min(100, Math.round((aliveCount / totalCount) * 100)) : 0;
    const votingUnlocked = room.round >= room.votingThreshold;
    const timer = room.timer;

    appEl.innerHTML = `
      <div class="screen" style="padding-top:0;">
        <div class="game-topbar">
          <div class="brand"><i class="fa-solid fa-radiation"></i> SHELTER</div>
          <div class="room-code-badge small">${escapeHtml(room.code)}</div>
          <div class="round-badge"><i class="fa-solid fa-hourglass-half"></i> ${t('game_round', { round: room.round })}</div>
          ${timer ? `<div class="timer-pill ${timer.type}">${timer.type === 'voting' ? '🗳' : '⏱'} <span data-ends-at="${timer.endsAt}">--:--</span></div>` : ''}
          <div class="topbar-actions">
            ${isHost ? `
              <button class="btn btn-secondary" id="situation-btn"><i class="fa-solid fa-triangle-exclamation"></i> ${t('btn_situation')}</button>
              <button class="btn btn-secondary" id="next-round-btn"><i class="fa-solid fa-forward"></i> ${t('btn_next_round')}</button>
              <button class="btn btn-ghost" id="reset-game-btn"><i class="fa-solid fa-rotate-left"></i> ${t('btn_new_game')}</button>
            ` : ''}
            <button class="btn btn-ghost" id="rules-hint-btn" title="${t('title_rules_hint')}"><i class="fa-solid fa-circle-question"></i></button>
            <button class="btn btn-ghost" id="leave-home-btn"><i class="fa-solid fa-arrow-right-from-bracket"></i></button>
          </div>
        </div>

        ${gameHintBannerHtml()}

        <div class="survivors-bar-wrap">
          <div class="survivors-bar-label">
            <span><i class="fa-solid fa-people-roof"></i> ${t('survivors_label', { alive: aliveCount, total: totalCount })}${room.bunker && room.bunker.capacity ? t('target_suffix', { capacity: room.bunker.capacity }) : ''}</span>
            <span>${votingUnlocked ? `<i class="fa-solid fa-unlock" style="color:var(--toxic);"></i> ${t('voting_available')}` : t('voting_opens_in', { round: room.votingThreshold })}</span>
          </div>
          <div class="survivors-bar"><div class="survivors-bar-fill ${pct < 40 ? 'over' : ''}" style="width:${pct}%"></div></div>
        </div>

        <div class="info-strip">
          <div class="panel mini-panel"><div class="mini-title"><i class="fa-solid ${room.catastrophe ? room.catastrophe.icon : 'fa-radiation'}"></i>${t('mini_catastrophe')}</div><div class="mini-value">${escapeHtml(room.catastrophe ? tc(room.catastrophe.title) : '—')}</div></div>
          <div class="panel mini-panel"><div class="mini-title"><i class="fa-solid fa-ruler-combined"></i>${t('mini_bunker')}</div><div class="mini-value">${escapeHtml(room.bunker ? tc(room.bunker.size) : '—')}</div></div>
          <div class="panel mini-panel"><div class="mini-title"><i class="fa-solid fa-hourglass-half"></i>${t('mini_duration')}</div><div class="mini-value">${escapeHtml(room.bunker ? tc(room.bunker.duration) : '—')}</div></div>
          <div class="panel mini-panel"><div class="mini-title"><i class="fa-solid fa-drumstick-bite"></i>${t('mini_food')}</div><div class="mini-value">${escapeHtml(room.bunker ? tc(room.bunker.foodSupply) : '—')}</div></div>
          <div class="panel mini-panel"><div class="mini-title"><i class="fa-solid fa-people-roof"></i>${t('mini_capacity')}</div><div class="mini-value">${room.bunker && room.bunker.capacity ? t('capacity_person_suffix', { n: room.bunker.capacity }) : '—'}</div></div>
        </div>

        <div class="main-columns">
          <div class="players-grid-wrap bunker-scene-panel">
            ${sceneBackdropHtml('bunker')}
            ${renderPlayersArenaHtml(data, isHost)}
          </div>
          <aside class="side-panel">
            <div class="panel voting-card" id="voting-card">${renderVotingCardHtml(data, isHost)}</div>
            <div class="panel chat-card" id="chat-card">${renderChatCardHtml(data, isHost)}</div>
          </aside>
        </div>

        <div class="app-footer">${t('footer_copyright_board')}</div>
      </div>
    `;

    attachGameHandlers(data, isHost);
    attachGameHintHandler();
  }

  // ---------------------------------------------------------------------
  // ПОБЕДА (room.status === 'ended') — вместимость бункера достигнута
  // ---------------------------------------------------------------------

  function renderVictory(data) {
    const room = data.room;
    const me = data.me;
    const isHost = !!(me && room.hostPlayerId === me.id);
    const players = data.players || [];
    const winners = players.filter((p) => p.claimed && !p.excluded);
    const losers = players.filter((p) => p.claimed && p.excluded);
    const capacity = room.bunker ? room.bunker.capacity : null;

    appEl.innerHTML = `
      <div class="catastrophe-screen victory-screen">
        ${sceneBackdropHtml('safe')}
        <div class="confetti-layer" id="confetti-layer"></div>
        <div class="catastrophe-alert victory-alert"><i class="fa-solid fa-trophy"></i> ${t('victory_alert')} <i class="fa-solid fa-trophy"></i></div>
        <div class="panel catastrophe-card victory-card">
          ${roomCodeBadgeHtml(room.code)}
          <i class="fa-solid fa-trophy catastrophe-icon victory-icon"></i>
          <h2 class="catastrophe-title">${t('victory_title')}</h2>
          <p class="catastrophe-desc">${capacity ? t('victory_desc_capacity', { capacity }) : t('victory_desc_no_capacity')}</p>

          <div class="victory-winners-list">
            ${winners.map((p) => `
              <div class="victory-winner-item">
                <i class="fa-solid fa-user-check"></i>
                <span class="winner-name">${escapeHtml(p.name)}</span>
                <span class="winner-prof">${escapeHtml(tc(p.profession || ''))}</span>
              </div>
            `).join('') || `<div class="setup-hint">${t('victory_no_winners')}</div>`}
          </div>

          ${losers.length ? `
            <div class="victory-losers-wrap">
              <div class="victory-losers-title"><i class="fa-solid fa-user-slash"></i> ${t('victory_surface_title')}</div>
              <div class="victory-losers-list">
                ${losers.map((p) => `<span class="victory-loser-chip">${escapeHtml(p.name)}</span>`).join('')}
              </div>
            </div>
          ` : ''}

          <div class="catastrophe-actions">
            ${isHost ? `
              <button class="btn btn-primary" id="new-game-btn"><i class="fa-solid fa-rotate-left"></i> ${t('btn_new_game')}</button>
            ` : `
              <div class="setup-hint"><i class="fa-solid fa-hourglass-half"></i> ${t('victory_waiting_host')}</div>
            `}
            <button class="btn btn-ghost" id="leave-home-btn"><i class="fa-solid fa-arrow-right-from-bracket"></i> ${t('btn_leave_menu')}</button>
          </div>
        </div>
        <div class="app-footer">${t('footer_copyright_board')}</div>
      </div>
    `;

    attachRoomCodeCopy();

    const newGameBtn = document.getElementById('new-game-btn');
    if (newGameBtn) newGameBtn.addEventListener('click', async () => {
      try { await api('post', `/${session.code}/reset`, {}); await pollOnce(); }
      catch (e) { showToast(t('toast_error_title'), errorMessageFrom(e), 'fa-triangle-exclamation'); }
    });

    const leaveBtn = document.getElementById('leave-home-btn');
    if (leaveBtn) leaveBtn.addEventListener('click', handleLeaveToHome);
  }

  // Роли-иконки для лицевой стороны карточки (силуэт-плакат в духе референса);
  // подбирается детерминированно по id игрока, чтобы не "прыгала" между поллингами.
  const CARD_FACE_ICONS = ['fa-flask', 'fa-user-doctor', 'fa-gear', 'fa-crosshairs', 'fa-microscope', 'fa-hammer', 'fa-shield-halved', 'fa-book'];

  function renderPlayersArenaHtml(data, isHost) {
    const players = (data.players || []).filter((p) => p.claimed);
    const me = players.find((p) => p.isMe);
    const others = players.filter((p) => !p.isMe);
    const ctx = { isHost, room: data.room, data };

    // "Я" — по центру (или первым на мобильных, где раскладка становится списком),
    // остальные — по бокам в порядке слотов.
    const orderedIds = players.map((p) => p.id).join(',');

    return `
      <div class="players-arena" id="players-grid" data-order="${orderedIds}">
        ${others.length ? `<div class="players-arena-side players-arena-side-left">${others.filter((_, i) => i % 2 === 0).map((p) => renderPlayerCardMp(p, ctx)).join('')}</div>` : ''}
        <div class="players-arena-center">
          ${me ? renderPlayerCardMp(me, ctx) : ''}
        </div>
        ${others.length ? `<div class="players-arena-side players-arena-side-right">${others.filter((_, i) => i % 2 === 1).map((p) => renderPlayerCardMp(p, ctx)).join('')}</div>` : ''}
      </div>
    `;
  }

  function renderPlayerCardMp(p, ctx) {
    const initial = (p.name || '?').trim().charAt(0).toUpperCase() || '?';
    const isHostSeat = ctx.room.hostPlayerId === p.id;
    const isMe = !!p.isMe;
    const voting = ctx.data.voting;
    const votingActive = voting && voting.status === 'active';
    const meExcluded = !!(ctx.data.players.find((x) => x.isMe) || {}).excluded;
    const canVoteFor = votingActive && !isMe && !p.excluded && !meExcluded;
    const myVoteTargetId = votingActive ? voting.myVoteTargetId : null;
    const voteCount = votingActive ? (voting.tally[p.id] || 0) : 0;
    const isVoteLeader = votingActive && voting.currentLeaders && voting.currentLeaders.length === 1 && voting.currentLeaders[0] === p.id && voteCount > 0;
    const iAmVotingForThem = canVoteFor && myVoteTargetId === p.id;
    const isFlipped = flippedCardIds.has(p.id);
    const revealedCount = ATTR_FIELDS.filter((f) => p.revealed && p.revealed[f.key]).length;
    const faceIcon = p.excluded ? 'fa-skull' : CARD_FACE_ICONS[p.id % CARD_FACE_ICONS.length];

    return `
      <div class="player-card-flip ${isMe ? 'is-me' : ''} ${p.excluded ? 'excluded' : ''} ${isFlipped ? 'is-flipped' : ''}" id="card-${p.id}" data-player-id="${p.id}">
        <div class="player-card-flip-inner">

          <div class="player-card player-card-face ${isVoteLeader ? 'vote-leader' : ''}" data-action="flip" data-target-id="${p.id}">
            <div class="card-face-silhouette"><i class="fa-solid ${faceIcon}"></i></div>
            ${isMe ? `<div class="card-face-you-tag">${t('card_you_label')}</div>` : ''}
            ${isHostSeat ? `<div class="card-face-host-tag" title="${t('seat_host_title')}"><i class="fa-solid fa-crown"></i></div>` : ''}
            ${votingActive ? `
              <div class="card-vote-badge ${isVoteLeader ? 'is-leader' : ''}" title="${t('votes_received', { count: voteCount })}">
                <i class="fa-solid fa-square-poll-vertical"></i>${voteCount}
              </div>
            ` : ''}
            <div class="card-face-body">
              <div class="card-face-name">${escapeHtml(p.name)}</div>
              <div class="card-face-profession">${escapeHtml(tc(p.profession || ''))}</div>
              <div class="card-face-dots">
                ${ATTR_FIELDS.map((f) => `<span class="card-face-dot ${p.revealed && p.revealed[f.key] ? 'lit' : ''}"></span>`).join('')}
              </div>
              <div class="card-face-hint"><i class="fa-solid fa-hand-pointer"></i> ${t('card_flip_hint')}</div>
            </div>
            ${p.excluded ? `<div class="card-face-excluded-tag">${t('card_excluded_label')}</div>` : ''}
          </div>

          <div class="player-card player-card-back ${p.excluded ? 'excluded' : ''} ${isMe ? 'is-me' : ''} ${isVoteLeader ? 'vote-leader' : ''}">
            <div class="player-card-head">
              <div class="player-avatar">${initial}</div>
              <div class="player-name-static">
                ${escapeHtml(p.name)}
                ${isMe ? `<span class="me-badge">${t('seat_me_badge')}</span>` : ''}
                ${isHostSeat ? `<span class="host-badge" title="${t('seat_host_title')}"><i class="fa-solid fa-crown"></i></span>` : ''}
              </div>
              ${votingActive ? `
                <div class="card-vote-badge ${isVoteLeader ? 'is-leader' : ''}" title="${t('votes_received', { count: voteCount })}">
                  <i class="fa-solid fa-square-poll-vertical"></i>${voteCount}
                </div>
              ` : ''}
              <div class="player-card-actions">
                <button class="icon-toggle" data-action="flip" data-target-id="${p.id}" title="${t('card_flip_back_title')}"><i class="fa-solid fa-rotate-left"></i></button>
                ${ctx.isHost ? `<button class="icon-toggle ${p.excluded ? 'active' : ''}" data-action="exclude" data-target-id="${p.id}" title="${t('exclude_toggle_title')}"><i class="fa-solid ${p.excluded ? 'fa-user-check' : 'fa-user-slash'}"></i></button>` : ''}
              </div>
            </div>

            <div class="player-profession-strip">
              <i class="fa-solid fa-briefcase"></i>
              <div><span class="prof-label">${t('player_profession_label')}</span><span class="prof-text">${escapeHtml(tc(p.profession || ''))}</span></div>
            </div>

            <div class="card-revealed-progress">
              <i class="fa-solid fa-list-check"></i> ${t('card_revealed_count', { revealed: revealedCount, total: ATTR_FIELDS.length })}
            </div>

            <div class="attributes-list">
              ${ATTR_FIELDS.map((f) => renderAttrRowMp(p, f, isMe)).join('')}
            </div>

            ${canVoteFor ? `
              <button class="vote-target-btn ${iAmVotingForThem ? 'chosen' : ''}" data-action="vote" data-target-id="${p.id}">
                <i class="fa-solid fa-square-poll-vertical"></i> ${iAmVotingForThem ? t('vote_own') : t('vote_against')}
              </button>
            ` : ''}
          </div>

        </div>
      </div>
    `;
  }

  function renderAttrRowMp(p, f, isMe) {
    const revealed = !!(p.revealed && p.revealed[f.key]);
    const value = p[f.key];
    const label = t('attr_' + f.key);
    const classes = ['attr-row'];
    if (isMe) classes.push('mine');
    classes.push(revealed ? 'revealed' : 'hidden-state');

    const head = isMe
      ? `<div class="attr-row-head attr-head-toggle" data-action="reveal" data-field="${f.key}">
           <div class="attr-label"><i class="fa-solid ${f.icon}"></i>${label}</div>
           ${revealed
              ? `<i class="fa-solid fa-lock-open" style="color:var(--rust-light);font-size:11px;"></i>`
              : `<div class="attr-lock">
                   <button class="attr-reroll" data-action="reroll" data-field="${f.key}" title="${t('reroll_title')}"><i class="fa-solid fa-dice"></i></button>
                   <i class="fa-solid fa-lock"></i>
                 </div>`}
         </div>`
      : `<div class="attr-row-head">
           <div class="attr-label"><i class="fa-solid ${f.icon}"></i>${label}</div>
           ${revealed ? `<i class="fa-solid fa-eye" style="color:var(--rust-light);font-size:11px;"></i>` : `<i class="fa-solid fa-lock" style="font-size:11px;color:var(--text-faint);"></i>`}
         </div>`;

    const showValue = isMe || revealed;
    return `<div class="${classes.join(' ')}">${head}${showValue ? `<div class="attr-value">${escapeHtml(tc(String(value == null ? '' : value)))}</div>` : ''}</div>`;
  }

  function renderVotingCardHtml(data, isHost) {
    const room = data.room;
    const voting = data.voting;
    const votingUnlocked = room.round >= room.votingThreshold;
    const alivePlayers = data.players.filter((p) => p.claimed && !p.excluded);
    const meExcluded = !!(data.players.find((p) => p.isMe) || {}).excluded;
    const enoughAliveForVote = alivePlayers.length >= 3;

    if (voting && voting.status === 'active') {
      const canFinalizeNow = isHost || Number(voting.endsAt) <= Date.now();
      const pct = voting.totalVoters > 0 ? Math.round((voting.votesCast / voting.totalVoters) * 100) : 0;
      const leaders = voting.currentLeaders || [];
      const nonVoters = voting.nonVoters || [];

      let leaderNote = '';
      if (leaders.length === 1) {
        const leaderPlayer = data.players.find((p) => p.id === leaders[0]);
        leaderNote = `<div class="voting-leader-note"><i class="fa-solid fa-triangle-exclamation"></i> ${t('voting_leader_note', { name: leaderPlayer ? escapeHtml(leaderPlayer.name) : '', votes: voting.tally[leaders[0]] || 0 })}</div>`;
      } else if (leaders.length > 1) {
        leaderNote = `<div class="voting-leader-note is-tie"><i class="fa-solid fa-scale-balanced"></i> ${t('voting_leader_tie_note')}</div>`;
      } else {
        leaderNote = `<div class="voting-leader-note is-empty">${t('voting_no_votes_note')}</div>`;
      }

      const waitingNote = (!canFinalizeNow && nonVoters.length > 0)
        ? `<div class="voting-waiting-note"><i class="fa-solid fa-hourglass-half"></i> ${t('voting_waiting_for', { names: nonVoters.map((n) => escapeHtml(n.name)).join(', ') })}</div>`
        : (voting.votesCast >= voting.totalVoters && voting.totalVoters > 0
            ? `<div class="voting-waiting-note is-complete"><i class="fa-solid fa-circle-check"></i> ${t('voting_all_voted')}</div>`
            : '');

      const myHint = meExcluded ? '' : (voting.myVoteTargetId
        ? `<p class="setup-hint voting-my-hint">${t('voting_you_voted_hint')}</p>`
        : `<p class="setup-hint voting-my-hint">${t('voting_vote_now_hint')}</p>`);

      return `
        <div class="voting-header">
          <div class="rules-title"><i class="fa-solid fa-square-poll-vertical"></i> ${t('voting_round_title', { round: voting.round })}</div>
          <div class="timer-pill voting"><span data-ends-at="${voting.endsAt}">--:--</span></div>
        </div>
        <div class="voting-progress-wrap">
          <div class="voting-progress-note">
            <span>${t('voting_progress_label')}</span>
            <span>${t('votes_cast', { cast: voting.votesCast, total: voting.totalVoters })}</span>
          </div>
          <div class="voting-progress-bar"><div class="voting-progress-fill" style="width:${pct}%;"></div></div>
        </div>
        ${leaderNote}
        ${waitingNote}
        ${myHint}
        <div class="voting-list">
          ${alivePlayers.map((p) => {
            const votes = voting.tally[p.id] || 0;
            const isTarget = voting.myVoteTargetId === p.id;
            const isLeader = leaders.length === 1 && leaders[0] === p.id;
            const hasVoted = !nonVoters.some((n) => n.id === p.id);
            return `
              <div class="voting-row ${isLeader ? 'is-leader' : ''} ${isTarget ? 'is-my-target' : ''}">
                <div class="voting-name">
                  <i class="fa-solid fa-user"></i> ${escapeHtml(p.name)}
                  ${p.isMe ? ` <span class="me-badge">${t('seat_me_badge')}</span>` : ''}
                  ${hasVoted ? `<i class="fa-solid fa-check voting-cast-check" title="${t('voting_progress_label')}"></i>` : ''}
                </div>
                <div class="voting-controls">
                  <span class="vote-count ${isLeader ? 'is-leader' : ''}">${votes}</span>
                  ${(!p.isMe && !meExcluded) ? `<button class="vote-btn-small ${isTarget ? 'chosen' : ''}" data-action="vote" data-target-id="${p.id}" title="${isTarget ? t('vote_change') : t('vote_against')}"><i class="fa-solid fa-hand-point-right"></i></button>` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <div class="modal-actions voting-actions-row">
          ${isHost ? `
            <button class="btn btn-secondary btn-xs" id="vote-cancel-btn">
              <i class="fa-solid fa-ban"></i> ${t('cancel_vote_btn')}
            </button>
          ` : ''}
          <button class="btn btn-danger" id="vote-finalize-btn" ${canFinalizeNow ? '' : `disabled title="${t('finalize_disabled_title')}"`}>
            <i class="fa-solid fa-flag-checkered"></i> ${t('finalize_btn')}
          </button>
        </div>
      `;
    }

    if (voting && voting.status === 'finished' && voting.result) {
      const r = voting.result;
      let resultText = t('voting_result_none');
      let resultClass = 'none';
      if (r.excludedPlayerId) {
        const target = data.players.find((p) => p.id === r.excludedPlayerId);
        resultText = t('voting_result_excluded', { name: target ? escapeHtml(target.name) : '', votes: r.tally[r.excludedPlayerId] });
        resultClass = 'excluded';
      } else if (r.tie) {
        resultText = t('voting_result_tie');
        resultClass = 'tie';
      }
      return `
        <div class="rules-title"><i class="fa-solid fa-square-poll-vertical"></i> ${t('voting_result_title', { round: voting.round })}</div>
        <p class="setup-hint voting-result-note is-${resultClass}" style="margin:10px 0 16px;">${resultText}</p>
        ${isHost && votingUnlocked && enoughAliveForVote ? `
          <div class="voting-start-row">
            <input type="number" id="voting-seconds-input" min="15" max="3600" value="90" class="seconds-input" inputmode="numeric" />
            <span class="seconds-label">${t('voting_seconds_suffix')}</span>
            <button class="btn btn-danger" id="vote-start-btn"><i class="fa-solid fa-square-poll-vertical"></i> ${t('voting_new_vote_btn')}</button>
          </div>
        ` : ''}
      `;
    }

    if (!votingUnlocked) {
      return `
        <div class="rules-title"><i class="fa-solid fa-lock"></i> ${t('voting_title')}</div>
        <p class="setup-hint">${t('voting_locked_hint', { threshold: room.votingThreshold, round: room.round })}</p>
      `;
    }

    if (!enoughAliveForVote) {
      return `
        <div class="rules-title"><i class="fa-solid fa-lock"></i> ${t('voting_title')}</div>
        <p class="setup-hint">${t('voting_locked_players_hint')}</p>
      `;
    }

    return `
      <div class="rules-title"><i class="fa-solid fa-square-poll-vertical"></i> ${t('voting_title')}</div>
      ${isHost ? `
        <p class="setup-hint" style="margin-bottom:12px;">${t('voting_host_hint')}</p>
        <div class="voting-start-row">
          <input type="number" id="voting-seconds-input" min="15" max="3600" value="90" class="seconds-input" inputmode="numeric" />
          <span class="seconds-label">${t('voting_seconds_suffix')}</span>
          <button class="btn btn-danger" id="vote-start-btn"><i class="fa-solid fa-square-poll-vertical"></i> ${t('voting_start_btn')}</button>
        </div>
      ` : `<p class="setup-hint">${t('voting_available_hint')}</p>`}
    `;
  }

  function renderChatCardHtml(data, isHost) {
    const room = data.room;
    const chat = data.chat || [];
    const me = data.me;
    const discussionTimer = room.timer && room.timer.type === 'discussion' ? room.timer : null;

    // Определяем, какие сообщения "новые" с прошлого рендера этой карточки,
    // чтобы проиграть входную анимацию только для них (а не для всей истории
    // чата заново на каждый поллинг раз в 2.5с).
    const newStartIdx = lastSeenChatCount < 0 ? chat.length : Math.min(lastSeenChatCount, chat.length);
    const hasGenuinelyNew = lastSeenChatCount >= 0 && chat.length > lastSeenChatCount;
    if (hasGenuinelyNew) {
      const newest = chat[chat.length - 1];
      if (newest && newest.type !== 'system' && (!me || newest.playerId !== me.id)) {
        playSfx('message');
      }
    }
    lastSeenChatCount = chat.length;

    return `
      <div class="chat-header">
        <div class="rules-title" style="margin-bottom:0;"><i class="fa-solid fa-comments"></i> ${t('chat_title')}</div>
        ${discussionTimer ? `<div class="timer-pill discussion"><i class="fa-solid fa-hourglass-half"></i> <span data-ends-at="${discussionTimer.endsAt}">--:--</span></div>` : ''}
      </div>
      ${isHost ? `
        <div class="discussion-timer-controls">
          <input type="number" id="discussion-seconds-input" min="15" max="1800" value="${discussionTimer ? discussionTimer.seconds : 180}" class="seconds-input" />
          <span class="seconds-label">${t('voting_seconds_suffix')}</span>
          <button class="btn btn-secondary btn-xs" id="discussion-start-btn"><i class="fa-solid fa-hourglass-start"></i> ${t('discussion_timer_btn')}</button>
          ${discussionTimer ? `<button class="btn btn-ghost btn-xs" id="discussion-cancel-btn"><i class="fa-solid fa-xmark"></i></button>` : ''}
        </div>
      ` : ''}
      <div class="chat-messages" id="chat-messages">
        ${chat.map((m, i) => chatMessageHtml(m, i >= newStartIdx)).join('')}
      </div>
      <div class="chat-form">
        <input type="text" id="chat-input" class="chat-input" placeholder="${t('chat_input_placeholder')}" maxlength="500" autocomplete="off" />
        <button class="btn btn-primary btn-xs" id="chat-send-btn"><i class="fa-solid fa-paper-plane"></i></button>
      </div>
    `;
  }

  function chatMessageHtml(m, isNew) {
    const newCls = isNew ? ' msg-in' : '';
    if (m.type === 'system') {
      return `<div class="chat-message system${newCls}"><i class="fa-solid fa-tower-broadcast"></i> ${escapeHtml(translateSystemMessage(m.text))}</div>`;
    }
    return `<div class="chat-message${newCls}">
      <span class="chat-author">${escapeHtml(m.playerName || t('default_player_name'))}:</span>
      <span class="chat-text">${escapeHtml(m.text)}</span>
    </div>`;
  }

  function attachGameHandlers(data, isHost) {
    attachRoomCodeCopy();

    const leaveBtn = document.getElementById('leave-home-btn');
    if (leaveBtn) leaveBtn.addEventListener('click', handleLeaveToHome);

    const rulesHintBtn = document.getElementById('rules-hint-btn');
    if (rulesHintBtn) rulesHintBtn.addEventListener('click', showRulesModal);

    const grid = document.getElementById('players-grid');
    if (grid) grid.addEventListener('click', onPlayersGridClick);

    const votingCard = document.getElementById('voting-card');
    if (votingCard) votingCard.addEventListener('click', onVotingCardClick);

    if (isHost) {
      const situationBtn = document.getElementById('situation-btn');
      if (situationBtn) situationBtn.addEventListener('click', async () => {
        try { await api('post', `/${session.code}/situation`, {}); playSfx('alarm'); await pollOnce(); }
        catch (e) { showToast(t('toast_error_title'), errorMessageFrom(e), 'fa-triangle-exclamation'); }
      });

      const nextRoundBtn = document.getElementById('next-round-btn');
      if (nextRoundBtn) nextRoundBtn.addEventListener('click', async () => {
        try { await api('post', `/${session.code}/next-round`, { seconds: 180 }); playSfx('open'); await pollOnce(); }
        catch (e) { showToast(t('toast_error_title'), errorMessageFrom(e), 'fa-triangle-exclamation'); }
      });

      const resetBtn = document.getElementById('reset-game-btn');
      if (resetBtn) resetBtn.addEventListener('click', handleResetGameConfirm);

      const discussionStartBtn = document.getElementById('discussion-start-btn');
      if (discussionStartBtn) discussionStartBtn.addEventListener('click', async () => {
        const input = document.getElementById('discussion-seconds-input');
        const seconds = Math.min(Math.max(Number(input.value) || 180, 15), 1800);
        try { await api('post', `/${session.code}/timer/start`, { seconds, label: 'Обсуждение' }); await pollOnce(); }
        catch (e) { showToast(t('toast_error_title'), errorMessageFrom(e), 'fa-triangle-exclamation'); }
      });

      const discussionCancelBtn = document.getElementById('discussion-cancel-btn');
      if (discussionCancelBtn) discussionCancelBtn.addEventListener('click', async () => {
        try { await api('post', `/${session.code}/timer/cancel`, {}); await pollOnce(); }
        catch (e) { /* ignore */ }
      });
    }

    const chatSendBtn = document.getElementById('chat-send-btn');
    const chatInput = document.getElementById('chat-input');
    if (chatSendBtn && chatInput) {
      const sendChat = async () => {
        const text = chatInput.value.trim();
        if (!text) return;
        chatInput.value = '';
        try { await api('post', `/${session.code}/chat`, { text }); playSfx('click'); await pollOnce(); }
        catch (e) { showToast(t('toast_error_title'), errorMessageFrom(e), 'fa-triangle-exclamation'); }
      };
      chatSendBtn.addEventListener('click', sendChat);
      chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });
    }
  }

  async function onPlayersGridClick(e) {
    const flipBtn = e.target.closest('[data-action="flip"]');
    if (flipBtn) {
      const targetId = Number(flipBtn.dataset.targetId);
      const card = document.getElementById(`card-${targetId}`);
      const isNowFlipped = flippedCardIds.has(targetId);
      if (isNowFlipped) { flippedCardIds.delete(targetId); } else { flippedCardIds.add(targetId); }
      if (card) card.classList.toggle('is-flipped', !isNowFlipped);
      playSfx('click');
      return;
    }
    const rerollBtn = e.target.closest('[data-action="reroll"]');
    if (rerollBtn) {
      e.stopPropagation();
      const field = rerollBtn.dataset.field;
      try { await api('post', `/${session.code}/reroll-attr`, { field }); await pollOnce(); }
      catch (err) { showToast(t('toast_error_title'), errorMessageFrom(err), 'fa-triangle-exclamation'); }
      return;
    }
    const revealHead = e.target.closest('[data-action="reveal"]');
    if (revealHead) {
      const field = revealHead.dataset.field;
      try { await api('post', `/${session.code}/reveal`, { field }); playSfx('reveal'); await pollOnce(); }
      catch (err) { showToast(t('toast_error_title'), errorMessageFrom(err), 'fa-triangle-exclamation'); }
      return;
    }
    const excludeBtn = e.target.closest('[data-action="exclude"]');
    if (excludeBtn) {
      const targetId = Number(excludeBtn.dataset.targetId);
      try { await api('post', `/${session.code}/exclude`, { playerId: targetId }); playSfx('exclude'); await pollOnce(); }
      catch (err) { showToast(t('toast_error_title'), errorMessageFrom(err), 'fa-triangle-exclamation'); }
      return;
    }
    const voteBtn = e.target.closest('[data-action="vote"]');
    if (voteBtn) {
      const targetId = Number(voteBtn.dataset.targetId);
      try { await api('post', `/${session.code}/vote/cast`, { targetPlayerId: targetId }); playSfx('vote'); await pollOnce(); }
      catch (err) { showToast(t('toast_error_title'), errorMessageFrom(err), 'fa-triangle-exclamation'); }
    }
  }

  async function onVotingCardClick(e) {
    const startBtn = e.target.closest('#vote-start-btn');
    if (startBtn) {
      const input = document.getElementById('voting-seconds-input');
      const seconds = Math.min(Math.max(Number(input ? input.value : 90) || 90, 15), 3600);
      try { await api('post', `/${session.code}/vote/start`, { seconds }); playSfx('open'); await pollOnce(); }
      catch (err) { showToast(t('toast_error_title'), errorMessageFrom(err), 'fa-triangle-exclamation'); }
      return;
    }
    const finalizeBtn = e.target.closest('#vote-finalize-btn');
    if (finalizeBtn) {
      try { await api('post', `/${session.code}/vote/finalize`, {}); playSfx('exclude'); await pollOnce(); }
      catch (err) { showToast(t('toast_error_title'), errorMessageFrom(err), 'fa-triangle-exclamation'); }
      return;
    }
    const cancelBtn = e.target.closest('#vote-cancel-btn');
    if (cancelBtn) {
      handleCancelVoteConfirm();
      return;
    }
    const voteBtn = e.target.closest('[data-action="vote"]');
    if (voteBtn) {
      const targetId = Number(voteBtn.dataset.targetId);
      try { await api('post', `/${session.code}/vote/cast`, { targetPlayerId: targetId }); playSfx('vote'); await pollOnce(); }
      catch (err) { showToast(t('toast_error_title'), errorMessageFrom(err), 'fa-triangle-exclamation'); }
    }
  }

  function handleCancelVoteConfirm() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="panel modal-box">
        <i class="fa-solid fa-ban modal-icon" style="color:var(--danger);"></i>
        <h3>${t('cancel_vote_confirm_title')}</h3>
        <p>${t('cancel_vote_confirm_desc')}</p>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="modal-cancel-btn">${t('btn_cancel')}</button>
          <button class="btn btn-danger" id="modal-confirm-btn"><i class="fa-solid fa-ban"></i> ${t('cancel_vote_btn')}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('modal-cancel-btn').addEventListener('click', () => overlay.remove());
    document.getElementById('modal-confirm-btn').addEventListener('click', async () => {
      overlay.remove();
      try { await api('post', `/${session.code}/vote/cancel`, {}); await pollOnce(); }
      catch (e) { showToast(t('toast_error_title'), errorMessageFrom(e), 'fa-triangle-exclamation'); }
    });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  }

  function handleResetGameConfirm() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="panel modal-box">
        <i class="fa-solid fa-skull modal-icon" style="color:var(--danger);"></i>
        <h3>${t('reset_confirm_title')}</h3>
        <p>${t('reset_confirm_desc')}</p>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="modal-cancel-btn">${t('btn_cancel')}</button>
          <button class="btn btn-danger" id="modal-confirm-btn"><i class="fa-solid fa-rotate-left"></i> ${t('btn_confirm_reset')}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('modal-cancel-btn').addEventListener('click', () => overlay.remove());
    document.getElementById('modal-confirm-btn').addEventListener('click', async () => {
      overlay.remove();
      try { await api('post', `/${session.code}/reset`, {}); await pollOnce(); }
      catch (e) { showToast(t('toast_error_title'), errorMessageFrom(e), 'fa-triangle-exclamation'); }
    });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  }

  // ---------------------------------------------------------------------
  // Автоматические модалки: событие раунда и ситуация
  // ---------------------------------------------------------------------

  function checkAutoModals(data) {
    const room = data.room;
    if (!room) return;

    if (seenEventRound === null) {
      seenEventRound = room.round;
    } else if (room.event && room.round > seenEventRound) {
      seenEventRound = room.round;
      showEventModal(room.event, room.round);
    }

    const sig = room.situation ? JSON.stringify(room.situation) : null;
    if (seenSituationSig === undefined) {
      seenSituationSig = sig;
    } else if (sig && sig !== seenSituationSig) {
      seenSituationSig = sig;
      showSituationModal(room.situation);
    }
  }

  function showEventModal(eventText, round) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="panel modal-box">
        <i class="fa-solid fa-triangle-exclamation modal-icon"></i>
        <h3>${t('event_modal_title', { round })}</h3>
        <p>${escapeHtml(tc(eventText))}</p>
        <div class="modal-actions">
          <button class="btn btn-primary" id="modal-close-btn"><i class="fa-solid fa-check"></i> ${t('btn_understood')}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    playSfx('alarm');
    document.getElementById('modal-close-btn').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  }

  function showSituationModal(s) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="panel modal-box situation-box">
        <div class="situation-category"><i class="fa-solid ${s.icon}"></i> ${escapeHtml(tc(s.category))}</div>
        <h3>${escapeHtml(tc(s.title))}</h3>
        <p class="situation-text">${escapeHtml(tc(s.text))}</p>
        <div class="setup-hint" style="margin-bottom:18px;">${t('situation_discuss_hint')}</div>
        <div class="modal-actions">
          <button class="btn btn-primary" id="situation-close-btn"><i class="fa-solid fa-check"></i> ${t('situation_close_btn')}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    playSfx('open');
    document.getElementById('situation-close-btn').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  }

  // ---------------------------------------------------------------------
  // TOASTS
  // ---------------------------------------------------------------------

  function showToast(title, message, icon) {
    if (!toastContainer) ensureToastContainer();
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <div class="toast-title"><i class="fa-solid ${icon || 'fa-info-circle'}"></i>${escapeHtml(title)}</div>
      <div>${escapeHtml(message)}</div>
    `;
    toastContainer.appendChild(toast);
    playSfx('toast');
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 320);
    }, 3600);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  // -------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', init);
})();
