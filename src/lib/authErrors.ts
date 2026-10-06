// Localized sign-in/sign-up error messages and password-rule copy.
// App language decides: KO -> Korean. EN -> English, except when the browser language is
// ja, zh-CN, zh-TW, vi or es, where only these auth messages switch to that language.

export type AuthLocale = 'ko' | 'en' | 'ja' | 'zhCN' | 'zhTW' | 'vi' | 'es';

export type AuthErrorCode =
  | 'weak_password'
  | 'password_leaked'
  | 'password_mismatch'
  | 'user_already_exists'
  | 'email_already_registered'
  | 'user_not_found'
  | 'verification_required'
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'rate_limited'
  | 'code_mismatch'
  | 'code_expired'
  | 'code_not_found'
  | 'code_invalid_format'
  | 'too_many_attempts'
  | 'invalid_email'
  | 'missing_fields'
  | 'email_send_failed'
  | 'network_error'
  | 'server_error';

type UiKey =
  | 'ruleTitle' | 'ruleLength' | 'ruleLeaked' | 'strength'
  | 'strength1' | 'strength2' | 'strength3' | 'strength4'
  | 'goLogin' | 'goForgot';

type Dict = Record<AuthErrorCode | UiKey, string>;

const ko: Dict = {
  weak_password: '비밀번호가 너무 약해요. 6자 이상, 흔하지 않은 비밀번호를 사용해 주세요.',
  password_leaked: '유출된 적 있는 비밀번호예요. 다른 비밀번호를 사용해 주세요.',
  password_mismatch: '비밀번호가 서로 일치하지 않아요.',
  user_already_exists: '이미 가입된 이메일이에요.',
  email_already_registered: '이미 가입된 이메일이에요.',
  user_not_found: '이 이메일로 가입된 계정이 없어요.',
  verification_required: '이메일 인증이 만료되었어요. 인증코드를 다시 받아 주세요.',
  invalid_credentials: '이메일 또는 비밀번호가 올바르지 않아요.',
  email_not_confirmed: '이메일 인증이 완료되지 않은 계정이에요. 비밀번호 찾기로 다시 설정해 주세요.',
  rate_limited: '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.',
  code_mismatch: '인증코드가 일치하지 않아요.',
  code_expired: '인증코드가 만료되었어요. 새 코드를 받아 주세요.',
  code_not_found: '인증코드를 찾을 수 없어요. 새 코드를 받아 주세요.',
  code_invalid_format: '6자리 숫자 인증코드를 입력해 주세요.',
  too_many_attempts: '시도 횟수를 초과했어요. 새 코드를 받아 주세요.',
  invalid_email: '올바른 이메일 주소를 입력해 주세요.',
  missing_fields: '필요한 정보를 모두 입력해 주세요.',
  email_send_failed: '메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요.',
  network_error: '네트워크 연결을 확인하고 다시 시도해 주세요.',
  server_error: '일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.',
  ruleTitle: '비밀번호 규칙',
  ruleLength: '6자 이상',
  ruleLeaked: '유출된 적 있는 흔한 비밀번호는 사용할 수 없어요',
  strength: '강도',
  strength1: '너무 짧음', strength2: '약함', strength3: '보통', strength4: '강함',
  goLogin: '로그인', goForgot: '비밀번호 찾기',
};

const en: Dict = {
  weak_password: 'This password is too weak. Use at least 6 characters and avoid common passwords.',
  password_leaked: 'This password has appeared in a data leak. Please choose another.',
  password_mismatch: "Passwords don't match.",
  user_already_exists: 'This email is already registered.',
  email_already_registered: 'This email is already registered.',
  user_not_found: 'No account uses this email.',
  verification_required: 'Your email verification expired. Please request a new code.',
  invalid_credentials: 'Incorrect email or password.',
  email_not_confirmed: "This account's email isn't verified. Please reset your password.",
  rate_limited: 'Too many requests. Please try again in a moment.',
  code_mismatch: "The code doesn't match.",
  code_expired: 'The code has expired. Please request a new one.',
  code_not_found: "We couldn't find a code. Please request a new one.",
  code_invalid_format: 'Enter the 6-digit code.',
  too_many_attempts: 'Too many attempts. Please request a new code.',
  invalid_email: 'Please enter a valid email address.',
  missing_fields: 'Please fill in all required fields.',
  email_send_failed: "We couldn't send the email. Please try again shortly.",
  network_error: 'Check your connection and try again.',
  server_error: 'Something went wrong. Please try again shortly.',
  ruleTitle: 'Password rules',
  ruleLength: 'At least 6 characters',
  ruleLeaked: "Common or leaked passwords aren't allowed",
  strength: 'Strength',
  strength1: 'Too short', strength2: 'Weak', strength3: 'Fair', strength4: 'Strong',
  goLogin: 'Log in', goForgot: 'Forgot password',
};

const ja: Dict = {
  weak_password: 'パスワードが弱すぎます。6文字以上で、推測されにくいものにしてください。',
  password_leaked: 'このパスワードは過去に流出しています。別のパスワードを使用してください。',
  password_mismatch: 'パスワードが一致しません。',
  user_already_exists: 'このメールアドレスはすでに登録されています。',
  email_already_registered: 'このメールアドレスはすでに登録されています。',
  user_not_found: 'このメールアドレスのアカウントはありません。',
  verification_required: 'メール認証の有効期限が切れました。新しいコードを取得してください。',
  invalid_credentials: 'メールアドレスまたはパスワードが正しくありません。',
  email_not_confirmed: 'メール認証が完了していません。パスワードを再設定してください。',
  rate_limited: 'リクエストが多すぎます。しばらくしてから再度お試しください。',
  code_mismatch: '認証コードが一致しません。',
  code_expired: '認証コードの有効期限が切れました。新しいコードを取得してください。',
  code_not_found: '認証コードが見つかりません。新しいコードを取得してください。',
  code_invalid_format: '6桁の認証コードを入力してください。',
  too_many_attempts: '試行回数の上限を超えました。新しいコードを取得してください。',
  invalid_email: '有効なメールアドレスを入力してください。',
  missing_fields: '必要な情報をすべて入力してください。',
  email_send_failed: 'メールを送信できませんでした。しばらくしてから再度お試しください。',
  network_error: 'ネットワーク接続を確認して、もう一度お試しください。',
  server_error: 'エラーが発生しました。しばらくしてから再度お試しください。',
  ruleTitle: 'パスワードのルール',
  ruleLength: '6文字以上',
  ruleLeaked: '流出したよくあるパスワードは使用できません',
  strength: '強度',
  strength1: '短すぎる', strength2: '弱い', strength3: '普通', strength4: '強い',
  goLogin: 'ログイン', goForgot: 'パスワードを忘れた',
};

const zhCN: Dict = {
  weak_password: '密码太弱。请使用至少 6 个字符且不常见的密码。',
  password_leaked: '该密码曾被泄露，请换一个。',
  password_mismatch: '两次输入的密码不一致。',
  user_already_exists: '该邮箱已注册。',
  email_already_registered: '该邮箱已注册。',
  user_not_found: '没有使用该邮箱的账号。',
  verification_required: '邮箱验证已过期，请重新获取验证码。',
  invalid_credentials: '邮箱或密码不正确。',
  email_not_confirmed: '该账号邮箱尚未验证，请重置密码。',
  rate_limited: '请求过于频繁，请稍后再试。',
  code_mismatch: '验证码不正确。',
  code_expired: '验证码已过期，请重新获取。',
  code_not_found: '找不到验证码，请重新获取。',
  code_invalid_format: '请输入 6 位数字验证码。',
  too_many_attempts: '尝试次数过多，请重新获取验证码。',
  invalid_email: '请输入有效的邮箱地址。',
  missing_fields: '请填写所有必填信息。',
  email_send_failed: '邮件发送失败，请稍后再试。',
  network_error: '请检查网络连接后重试。',
  server_error: '出现错误，请稍后再试。',
  ruleTitle: '密码规则',
  ruleLength: '至少 6 个字符',
  ruleLeaked: '不能使用常见或已泄露的密码',
  strength: '强度',
  strength1: '太短', strength2: '弱', strength3: '中', strength4: '强',
  goLogin: '登录', goForgot: '忘记密码',
};

const zhTW: Dict = {
  weak_password: '密碼太弱。請使用至少 6 個字元且不常見的密碼。',
  password_leaked: '此密碼曾經外洩，請改用其他密碼。',
  password_mismatch: '兩次輸入的密碼不一致。',
  user_already_exists: '此電子郵件已註冊。',
  email_already_registered: '此電子郵件已註冊。',
  user_not_found: '沒有使用此電子郵件的帳號。',
  verification_required: '電子郵件驗證已過期，請重新取得驗證碼。',
  invalid_credentials: '電子郵件或密碼不正確。',
  email_not_confirmed: '此帳號的電子郵件尚未驗證，請重設密碼。',
  rate_limited: '請求過於頻繁，請稍後再試。',
  code_mismatch: '驗證碼不正確。',
  code_expired: '驗證碼已過期，請重新取得。',
  code_not_found: '找不到驗證碼，請重新取得。',
  code_invalid_format: '請輸入 6 位數字驗證碼。',
  too_many_attempts: '嘗試次數過多，請重新取得驗證碼。',
  invalid_email: '請輸入有效的電子郵件地址。',
  missing_fields: '請填寫所有必填資訊。',
  email_send_failed: '郵件寄送失敗，請稍後再試。',
  network_error: '請檢查網路連線後再試一次。',
  server_error: '發生錯誤，請稍後再試。',
  ruleTitle: '密碼規則',
  ruleLength: '至少 6 個字元',
  ruleLeaked: '不能使用常見或已外洩的密碼',
  strength: '強度',
  strength1: '太短', strength2: '弱', strength3: '中', strength4: '強',
  goLogin: '登入', goForgot: '忘記密碼',
};

const vi: Dict = {
  weak_password: 'Mật khẩu quá yếu. Hãy dùng ít nhất 6 ký tự và tránh mật khẩu phổ biến.',
  password_leaked: 'Mật khẩu này đã từng bị rò rỉ. Vui lòng chọn mật khẩu khác.',
  password_mismatch: 'Mật khẩu không khớp.',
  user_already_exists: 'Email này đã được đăng ký.',
  email_already_registered: 'Email này đã được đăng ký.',
  user_not_found: 'Không có tài khoản nào dùng email này.',
  verification_required: 'Xác minh email đã hết hạn. Vui lòng lấy mã mới.',
  invalid_credentials: 'Email hoặc mật khẩu không đúng.',
  email_not_confirmed: 'Email của tài khoản chưa được xác minh. Vui lòng đặt lại mật khẩu.',
  rate_limited: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
  code_mismatch: 'Mã xác minh không đúng.',
  code_expired: 'Mã đã hết hạn. Vui lòng lấy mã mới.',
  code_not_found: 'Không tìm thấy mã. Vui lòng lấy mã mới.',
  code_invalid_format: 'Nhập mã gồm 6 chữ số.',
  too_many_attempts: 'Bạn đã thử quá nhiều lần. Vui lòng lấy mã mới.',
  invalid_email: 'Vui lòng nhập địa chỉ email hợp lệ.',
  missing_fields: 'Vui lòng điền đầy đủ thông tin.',
  email_send_failed: 'Không gửi được email. Vui lòng thử lại sau.',
  network_error: 'Kiểm tra kết nối mạng rồi thử lại.',
  server_error: 'Đã xảy ra lỗi. Vui lòng thử lại sau.',
  ruleTitle: 'Quy tắc mật khẩu',
  ruleLength: 'Ít nhất 6 ký tự',
  ruleLeaked: 'Không dùng mật khẩu phổ biến hoặc đã bị rò rỉ',
  strength: 'Độ mạnh',
  strength1: 'Quá ngắn', strength2: 'Yếu', strength3: 'Trung bình', strength4: 'Mạnh',
  goLogin: 'Đăng nhập', goForgot: 'Quên mật khẩu',
};

const es: Dict = {
  weak_password: 'La contraseña es demasiado débil. Usa al menos 6 caracteres y evita contraseñas comunes.',
  password_leaked: 'Esta contraseña apareció en una filtración. Elige otra.',
  password_mismatch: 'Las contraseñas no coinciden.',
  user_already_exists: 'Este correo ya está registrado.',
  email_already_registered: 'Este correo ya está registrado.',
  user_not_found: 'No hay ninguna cuenta con este correo.',
  verification_required: 'La verificación del correo caducó. Solicita un código nuevo.',
  invalid_credentials: 'Correo o contraseña incorrectos.',
  email_not_confirmed: 'El correo de esta cuenta no está verificado. Restablece tu contraseña.',
  rate_limited: 'Demasiadas solicitudes. Inténtalo de nuevo en un momento.',
  code_mismatch: 'El código no coincide.',
  code_expired: 'El código caducó. Solicita uno nuevo.',
  code_not_found: 'No encontramos un código. Solicita uno nuevo.',
  code_invalid_format: 'Introduce el código de 6 dígitos.',
  too_many_attempts: 'Demasiados intentos. Solicita un código nuevo.',
  invalid_email: 'Introduce un correo electrónico válido.',
  missing_fields: 'Completa todos los campos obligatorios.',
  email_send_failed: 'No pudimos enviar el correo. Inténtalo de nuevo en breve.',
  network_error: 'Revisa tu conexión e inténtalo de nuevo.',
  server_error: 'Algo salió mal. Inténtalo de nuevo en breve.',
  ruleTitle: 'Reglas de la contraseña',
  ruleLength: 'Al menos 6 caracteres',
  ruleLeaked: 'No se permiten contraseñas comunes o filtradas',
  strength: 'Seguridad',
  strength1: 'Muy corta', strength2: 'Débil', strength3: 'Aceptable', strength4: 'Fuerte',
  goLogin: 'Iniciar sesión', goForgot: 'Olvidé mi contraseña',
};

const DICTS: Record<AuthLocale, Dict> = { ko, en, ja, zhCN, zhTW, vi, es };

export function pickAuthLocale(appLanguage: 'ko' | 'en', browserLanguage?: string | null): AuthLocale {
  if (appLanguage === 'ko') return 'ko';
  const b = (browserLanguage || '').toLowerCase();
  if (b.startsWith('ja')) return 'ja';
  if (b === 'zh-tw' || b === 'zh-hk' || b === 'zh-mo' || b.startsWith('zh-hant')) return 'zhTW';
  if (b === 'zh' || b === 'zh-cn' || b === 'zh-sg' || b.startsWith('zh-hans')) return 'zhCN';
  if (b.startsWith('vi')) return 'vi';
  if (b.startsWith('es')) return 'es';
  return 'en';
}

export function browserLanguage(): string {
  if (typeof navigator === 'undefined') return '';
  return navigator.languages?.[0] || navigator.language || '';
}

const ALIASES: Record<string, AuthErrorCode> = {
  email_exists: 'user_already_exists',
  user_already_registered: 'user_already_exists',
  over_request_rate_limit: 'rate_limited',
  over_email_send_rate_limit: 'rate_limited',
  over_sms_send_rate_limit: 'rate_limited',
  email_address_invalid: 'invalid_email',
  validation_failed: 'missing_fields',
  same_password: 'weak_password',
};

/** Normalizes server/Supabase error codes (and a few known English messages) to our codes. */
export function normalizeAuthErrorCode(code?: string | null, message?: string | null): AuthErrorCode {
  const c = (code || '').trim();
  if (c && c in DICTS.en) return c as AuthErrorCode;
  if (c && ALIASES[c]) return ALIASES[c];
  const m = (message || '').toLowerCase();
  if (m.includes('invalid login credentials')) return 'invalid_credentials';
  if (m.includes('email not confirmed')) return 'email_not_confirmed';
  if (m.includes('already registered')) return 'user_already_exists';
  if (m.includes('rate limit')) return 'rate_limited';
  if (m.includes('failed to fetch') || m.includes('network')) return 'network_error';
  if (m.includes('password')) return 'weak_password';
  return 'server_error';
}

export function authText(locale: AuthLocale, key: AuthErrorCode | UiKey): string {
  return DICTS[locale][key] ?? DICTS.en[key];
}

export function authErrorMessage(
  locale: AuthLocale,
  code: AuthErrorCode,
  opts: { remainingAttempts?: number; reasons?: string[] } = {},
): string {
  if (code === 'weak_password' && opts.reasons?.includes('pwned') && !opts.reasons.includes('length')) {
    return authText(locale, 'password_leaked');
  }
  const base = authText(locale, code);
  if (code === 'code_mismatch' && typeof opts.remainingAttempts === 'number') {
    return `${base} (${Math.max(0, opts.remainingAttempts)})`;
  }
  return base;
}
