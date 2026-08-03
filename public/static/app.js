// =====================================================================
// SHELTER — клиентское мультиплеерное приложение (комнаты, реальные игроки)
// =====================================================================

(function () {
  'use strict';

  const SESSION_KEY = 'bunker_mp_session_v1';
  const DEFAULT_NAME_KEY = 'bunker_default_name_v1';
  const LANG_KEY = 'shelter_lang_v1';
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

      // Лендинг
      landing_subtitle: 'сетевая игра на выживание — каждый со своего устройства',
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
      reroll_title: 'Перебросить, пока скрыто от других',

      // Голосование
      voting_round_title: 'Голосование — раунд {round}',
      votes_cast: 'Голосов подано: {cast} / {total}',
      finalize_btn: 'Завершить голосование',
      finalize_disabled_title: 'Завершить раньше времени может только хост',
      voting_result_title: 'Итоги голосования (раунд {round})',
      voting_result_none: 'Никто не был исключён.',
      voting_result_excluded: 'Исключён(а): {name} ({votes} голос.)',
      voting_result_tie: 'Ничья — никто не исключён.',
      voting_new_vote_btn: 'Новое голосование',
      voting_locked_hint: 'Голосование откроется начиная с {threshold}-го раунда. Сейчас раунд {round}.',
      voting_title: 'Голосование',
      voting_host_hint: 'Запустите голосование за исключение — у всех будет ограниченное время на голос.',
      voting_start_btn: 'Начать голосование',
      voting_seconds_suffix: 'сек.',
      voting_available_hint: 'Голосование доступно — хост может его запустить в любой момент.',

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

      landing_subtitle: 'an online survival game — everyone joins from their own device',
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
      reroll_title: 'Reroll while hidden from others',

      voting_round_title: 'Voting — round {round}',
      votes_cast: 'Votes cast: {cast} / {total}',
      finalize_btn: 'End voting',
      finalize_disabled_title: 'Only the host can end the vote early',
      voting_result_title: 'Voting results (round {round})',
      voting_result_none: 'No one was excluded.',
      voting_result_excluded: 'Excluded: {name} ({votes} votes)',
      voting_result_tie: 'Tie — no one excluded.',
      voting_new_vote_btn: 'New vote',
      voting_locked_hint: 'Voting opens starting from round {threshold}. Currently round {round}.',
      voting_title: 'Voting',
      voting_host_hint: 'Start an exclusion vote — everyone will have a limited time to vote.',
      voting_start_btn: 'Start voting',
      voting_seconds_suffix: 'sec.',
      voting_available_hint: 'Voting is available — the host can start it at any time.',

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

  const appEl = document.getElementById('app');
  let toastContainer = null;
  let langSwitcherEl = null;

  // ---------------------------------------------------------------------
  // Инициализация
  // ---------------------------------------------------------------------

  function init() {
    ensureToastContainer();
    ensureLangSwitcher();

    const params = new URLSearchParams(location.search);
    const roomFromUrl = (params.get('room') || '').toUpperCase().trim();

    if (session && session.code) {
      startPolling();
    } else if (roomFromUrl) {
      homeScreen = 'play';
      joinCodeDraft = roomFromUrl;
      renderHome();
    } else {
      renderHome();
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
      <div class="screen mp-home-screen view-enter">
        <div class="container">
          <div class="top-title">
            <i class="fa-solid fa-radiation"></i>
            <h1>SHELTER</h1>
          </div>
          <div class="subtitle">${t('landing_subtitle')}</div>

          <div class="landing-actions landing-actions-center">
            <button class="btn btn-primary btn-lg" id="landing-play-btn"><i class="fa-solid fa-play"></i> ${t('btn_play')}</button>
            <button class="btn btn-secondary" id="landing-howto-btn"><i class="fa-solid fa-circle-question"></i> ${t('btn_howto')}</button>
            <button class="btn btn-secondary" id="landing-settings-btn"><i class="fa-solid fa-gear"></i> ${t('btn_settings')}</button>
            <button class="btn btn-secondary" id="landing-support-btn"><i class="fa-brands fa-telegram"></i> ${t('btn_telegram')}</button>
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
          <h2 class="catastrophe-title">${escapeHtml(catastrophe.title)}</h2>
          <p class="catastrophe-desc">${escapeHtml(catastrophe.description || '')}</p>

          <div class="bunker-params">
            <div class="bunker-param"><div class="label"><i class="fa-solid fa-ruler-combined"></i>${t('label_size')}</div><div class="value">${escapeHtml(bunker.size || '')}</div></div>
            <div class="bunker-param"><div class="label"><i class="fa-solid fa-hourglass-half"></i>${t('label_duration')}</div><div class="value">${escapeHtml(bunker.duration || '')}</div></div>
            <div class="bunker-param"><div class="label"><i class="fa-solid fa-layer-group"></i>${t('label_floors')}</div><div class="value">${escapeHtml(bunker.floors || '')}</div></div>
            <div class="bunker-param"><div class="label"><i class="fa-solid fa-door-open"></i>${t('label_extra_room')}</div><div class="value">${escapeHtml(bunker.extraRoom || '')}</div></div>
            <div class="bunker-param"><div class="label"><i class="fa-solid fa-drumstick-bite"></i>${t('label_food')}</div><div class="value">${escapeHtml(bunker.foodSupply || '')}</div></div>
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

        <div class="survivors-bar-wrap">
          <div class="survivors-bar-label">
            <span><i class="fa-solid fa-people-roof"></i> ${t('survivors_label', { alive: aliveCount, total: totalCount })}${room.bunker && room.bunker.capacity ? t('target_suffix', { capacity: room.bunker.capacity }) : ''}</span>
            <span>${votingUnlocked ? `<i class="fa-solid fa-unlock" style="color:var(--toxic);"></i> ${t('voting_available')}` : t('voting_opens_in', { round: room.votingThreshold })}</span>
          </div>
          <div class="survivors-bar"><div class="survivors-bar-fill ${pct < 40 ? 'over' : ''}" style="width:${pct}%"></div></div>
        </div>

        <div class="info-strip">
          <div class="panel mini-panel"><div class="mini-title"><i class="fa-solid ${room.catastrophe ? room.catastrophe.icon : 'fa-radiation'}"></i>${t('mini_catastrophe')}</div><div class="mini-value">${escapeHtml(room.catastrophe ? room.catastrophe.title : '—')}</div></div>
          <div class="panel mini-panel"><div class="mini-title"><i class="fa-solid fa-ruler-combined"></i>${t('mini_bunker')}</div><div class="mini-value">${escapeHtml(room.bunker ? room.bunker.size : '—')}</div></div>
          <div class="panel mini-panel"><div class="mini-title"><i class="fa-solid fa-hourglass-half"></i>${t('mini_duration')}</div><div class="mini-value">${escapeHtml(room.bunker ? room.bunker.duration : '—')}</div></div>
          <div class="panel mini-panel"><div class="mini-title"><i class="fa-solid fa-drumstick-bite"></i>${t('mini_food')}</div><div class="mini-value">${escapeHtml(room.bunker ? room.bunker.foodSupply : '—')}</div></div>
          <div class="panel mini-panel"><div class="mini-title"><i class="fa-solid fa-people-roof"></i>${t('mini_capacity')}</div><div class="mini-value">${room.bunker && room.bunker.capacity ? t('capacity_person_suffix', { n: room.bunker.capacity }) : '—'}</div></div>
        </div>

        <div class="main-columns">
          <div class="players-grid-wrap bunker-scene-panel">
            ${sceneBackdropHtml('bunker')}
            <div class="players-grid" id="players-grid">
              ${players.filter((p) => p.claimed).map((p) => renderPlayerCardMp(p, { isHost, room, data })).join('')}
            </div>
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
                <span class="winner-prof">${escapeHtml(p.profession || '')}</span>
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

  function renderPlayerCardMp(p, ctx) {
    const initial = (p.name || '?').trim().charAt(0).toUpperCase() || '?';
    const isHostSeat = ctx.room.hostPlayerId === p.id;
    const isMe = !!p.isMe;
    const votingActive = ctx.data.voting && ctx.data.voting.status === 'active';
    const meExcluded = !!(ctx.data.players.find((x) => x.isMe) || {}).excluded;
    const canVoteFor = votingActive && !isMe && !p.excluded && !meExcluded;
    const myVoteTargetId = ctx.data.voting ? ctx.data.voting.myVoteTargetId : null;

    return `
      <div class="player-card ${p.excluded ? 'excluded' : ''} ${isMe ? 'is-me' : ''}" id="card-${p.id}">
        <div class="player-card-head">
          <div class="player-avatar">${initial}</div>
          <div class="player-name-static">
            ${escapeHtml(p.name)}
            ${isMe ? `<span class="me-badge">${t('seat_me_badge')}</span>` : ''}
            ${isHostSeat ? `<span class="host-badge" title="${t('seat_host_title')}"><i class="fa-solid fa-crown"></i></span>` : ''}
          </div>
          <div class="player-card-actions">
            ${ctx.isHost ? `<button class="icon-toggle ${p.excluded ? 'active' : ''}" data-action="exclude" data-target-id="${p.id}" title="${t('exclude_toggle_title')}"><i class="fa-solid ${p.excluded ? 'fa-user-check' : 'fa-user-slash'}"></i></button>` : ''}
          </div>
        </div>

        <div class="player-profession-strip">
          <i class="fa-solid fa-briefcase"></i>
          <div><span class="prof-label">${t('player_profession_label')}</span><span class="prof-text">${escapeHtml(p.profession || '')}</span></div>
        </div>

        <div class="attributes-list">
          ${ATTR_FIELDS.map((f) => renderAttrRowMp(p, f, isMe)).join('')}
        </div>

        ${canVoteFor ? `
          <button class="vote-target-btn ${myVoteTargetId === p.id ? 'chosen' : ''}" data-action="vote" data-target-id="${p.id}">
            <i class="fa-solid fa-square-poll-vertical"></i> ${myVoteTargetId === p.id ? t('vote_own') : t('vote_against')}
          </button>
        ` : ''}
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
    return `<div class="${classes.join(' ')}">${head}${showValue ? `<div class="attr-value">${escapeHtml(String(value == null ? '' : value))}</div>` : ''}</div>`;
  }

  function renderVotingCardHtml(data, isHost) {
    const room = data.room;
    const voting = data.voting;
    const votingUnlocked = room.round >= room.votingThreshold;
    const alivePlayers = data.players.filter((p) => p.claimed && !p.excluded);
    const meExcluded = !!(data.players.find((p) => p.isMe) || {}).excluded;

    if (voting && voting.status === 'active') {
      const canFinalizeNow = isHost || Number(voting.endsAt) <= Date.now();
      return `
        <div class="voting-header">
          <div class="rules-title"><i class="fa-solid fa-square-poll-vertical"></i> ${t('voting_round_title', { round: voting.round })}</div>
          <div class="timer-pill voting"><span data-ends-at="${voting.endsAt}">--:--</span></div>
        </div>
        <div class="voting-progress-note">${t('votes_cast', { cast: voting.votesCast, total: voting.totalVoters })}</div>
        <div class="voting-list">
          ${alivePlayers.map((p) => {
            const votes = voting.tally[p.id] || 0;
            const isTarget = voting.myVoteTargetId === p.id;
            return `
              <div class="voting-row">
                <div class="voting-name"><i class="fa-solid fa-user"></i> ${escapeHtml(p.name)}${p.isMe ? ` <span class="me-badge">${t('seat_me_badge')}</span>` : ''}</div>
                <div class="voting-controls">
                  <span class="vote-count">${votes}</span>
                  ${(!p.isMe && !meExcluded) ? `<button class="vote-btn-small ${isTarget ? 'chosen' : ''}" data-action="vote" data-target-id="${p.id}" title="${t('vote_against')}"><i class="fa-solid fa-hand-point-right"></i></button>` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <div class="modal-actions" style="margin-top:14px;">
          <button class="btn btn-danger" id="vote-finalize-btn" ${canFinalizeNow ? '' : `disabled title="${t('finalize_disabled_title')}"`}>
            <i class="fa-solid fa-flag-checkered"></i> ${t('finalize_btn')}
          </button>
        </div>
      `;
    }

    if (voting && voting.status === 'finished' && voting.result) {
      const r = voting.result;
      let resultText = t('voting_result_none');
      if (r.excludedPlayerId) {
        const target = data.players.find((p) => p.id === r.excludedPlayerId);
        resultText = t('voting_result_excluded', { name: target ? escapeHtml(target.name) : '', votes: r.tally[r.excludedPlayerId] });
      } else if (r.tie) {
        resultText = t('voting_result_tie');
      }
      return `
        <div class="rules-title"><i class="fa-solid fa-square-poll-vertical"></i> ${t('voting_result_title', { round: voting.round })}</div>
        <p class="setup-hint" style="margin:10px 0 16px;">${resultText}</p>
        ${isHost && votingUnlocked ? `
          <div class="voting-start-row">
            <input type="number" id="voting-seconds-input" min="15" max="900" value="60" class="seconds-input" />
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

    return `
      <div class="rules-title"><i class="fa-solid fa-square-poll-vertical"></i> ${t('voting_title')}</div>
      ${isHost ? `
        <p class="setup-hint" style="margin-bottom:12px;">${t('voting_host_hint')}</p>
        <div class="voting-start-row">
          <input type="number" id="voting-seconds-input" min="15" max="900" value="60" class="seconds-input" />
          <span class="seconds-label">${t('voting_seconds_suffix')}</span>
          <button class="btn btn-danger" id="vote-start-btn"><i class="fa-solid fa-square-poll-vertical"></i> ${t('voting_start_btn')}</button>
        </div>
      ` : `<p class="setup-hint">${t('voting_available_hint')}</p>`}
    `;
  }

  function renderChatCardHtml(data, isHost) {
    const room = data.room;
    const chat = data.chat || [];
    const discussionTimer = room.timer && room.timer.type === 'discussion' ? room.timer : null;

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
        ${chat.map((m) => chatMessageHtml(m)).join('')}
      </div>
      <div class="chat-form">
        <input type="text" id="chat-input" class="chat-input" placeholder="${t('chat_input_placeholder')}" maxlength="500" autocomplete="off" />
        <button class="btn btn-primary btn-xs" id="chat-send-btn"><i class="fa-solid fa-paper-plane"></i></button>
      </div>
    `;
  }

  function chatMessageHtml(m) {
    if (m.type === 'system') {
      return `<div class="chat-message system"><i class="fa-solid fa-tower-broadcast"></i> ${escapeHtml(m.text)}</div>`;
    }
    return `<div class="chat-message">
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
        try { await api('post', `/${session.code}/situation`, {}); await pollOnce(); }
        catch (e) { showToast(t('toast_error_title'), errorMessageFrom(e), 'fa-triangle-exclamation'); }
      });

      const nextRoundBtn = document.getElementById('next-round-btn');
      if (nextRoundBtn) nextRoundBtn.addEventListener('click', async () => {
        try { await api('post', `/${session.code}/next-round`, { seconds: 180 }); await pollOnce(); }
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
        try { await api('post', `/${session.code}/chat`, { text }); await pollOnce(); }
        catch (e) { showToast(t('toast_error_title'), errorMessageFrom(e), 'fa-triangle-exclamation'); }
      };
      chatSendBtn.addEventListener('click', sendChat);
      chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });
    }
  }

  async function onPlayersGridClick(e) {
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
      try { await api('post', `/${session.code}/reveal`, { field }); await pollOnce(); }
      catch (err) { showToast(t('toast_error_title'), errorMessageFrom(err), 'fa-triangle-exclamation'); }
      return;
    }
    const excludeBtn = e.target.closest('[data-action="exclude"]');
    if (excludeBtn) {
      const targetId = Number(excludeBtn.dataset.targetId);
      try { await api('post', `/${session.code}/exclude`, { playerId: targetId }); await pollOnce(); }
      catch (err) { showToast(t('toast_error_title'), errorMessageFrom(err), 'fa-triangle-exclamation'); }
      return;
    }
    const voteBtn = e.target.closest('[data-action="vote"]');
    if (voteBtn) {
      const targetId = Number(voteBtn.dataset.targetId);
      try { await api('post', `/${session.code}/vote/cast`, { targetPlayerId: targetId }); await pollOnce(); }
      catch (err) { showToast(t('toast_error_title'), errorMessageFrom(err), 'fa-triangle-exclamation'); }
    }
  }

  async function onVotingCardClick(e) {
    const startBtn = e.target.closest('#vote-start-btn');
    if (startBtn) {
      const input = document.getElementById('voting-seconds-input');
      const seconds = Math.min(Math.max(Number(input ? input.value : 60) || 60, 15), 900);
      try { await api('post', `/${session.code}/vote/start`, { seconds }); await pollOnce(); }
      catch (err) { showToast(t('toast_error_title'), errorMessageFrom(err), 'fa-triangle-exclamation'); }
      return;
    }
    const finalizeBtn = e.target.closest('#vote-finalize-btn');
    if (finalizeBtn) {
      try { await api('post', `/${session.code}/vote/finalize`, {}); await pollOnce(); }
      catch (err) { showToast(t('toast_error_title'), errorMessageFrom(err), 'fa-triangle-exclamation'); }
      return;
    }
    const voteBtn = e.target.closest('[data-action="vote"]');
    if (voteBtn) {
      const targetId = Number(voteBtn.dataset.targetId);
      try { await api('post', `/${session.code}/vote/cast`, { targetPlayerId: targetId }); await pollOnce(); }
      catch (err) { showToast(t('toast_error_title'), errorMessageFrom(err), 'fa-triangle-exclamation'); }
    }
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
        <p>${escapeHtml(eventText)}</p>
        <div class="modal-actions">
          <button class="btn btn-primary" id="modal-close-btn"><i class="fa-solid fa-check"></i> ${t('btn_understood')}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('modal-close-btn').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  }

  function showSituationModal(s) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="panel modal-box situation-box">
        <div class="situation-category"><i class="fa-solid ${s.icon}"></i> ${escapeHtml(s.category)}</div>
        <h3>${escapeHtml(s.title)}</h3>
        <p class="situation-text">${escapeHtml(s.text)}</p>
        <div class="setup-hint" style="margin-bottom:18px;">${t('situation_discuss_hint')}</div>
        <div class="modal-actions">
          <button class="btn btn-primary" id="situation-close-btn"><i class="fa-solid fa-check"></i> ${t('situation_close_btn')}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
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
