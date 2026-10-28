export type Language = 'en' | 'te';

export interface Translations {
  appName: string;
  tagline: string;
  // Nav
  dashboard: string;
  trips: string;
  expenses: string;
  settlements: string;
  reports: string;
  families: string;
  auditLog: string;
  login: string;
  logout: string;
  setupAdmin: string;
  language: string;
  // Common
  loading: string;
  save: string;
  cancel: string;
  delete: string;
  confirm: string;
  edit: string;
  close: string;
  back: string;
  actions: string;
  viewDetails: string;
  // Dashboard & Trips
  activeTrips: string;
  createTrip: string;
  newTrip: string;
  tripName: string;
  destination: string;
  dates: string;
  budget: string;
  status: string;
  privateTrip: string;
  planning: string;
  upcoming: string;
  ongoing: string;
  completed: string;
  markCompleted: string;
  participants: string;
  // Attendance
  attendance: string;
  rsvpComing: string;
  rsvpNotComing: string;
  rsvpPending: string;
  myRsvp: string;
  updateAttendance: string;
  attendanceHistory: string;
  // Expenses & Items
  addExpense: string;
  itemizedBill: string;
  quickSplit: string;
  expenseTitle: string;
  expenseDate: string;
  category: string;
  paidBy: string;
  totalAmount: string;
  splitMethod: string;
  equalSplit: string;
  perHeadSplit: string;
  customSplit: string;
  percentageSplit: string;
  familyWiseSplit: string;
  mixedSplit: string;
  individualRemainderSplit: string;
  individualPortion: string;
  individualTotal: string;
  sharedRemainder: string;
  equalRemainderShare: string;
  // Itemized bill specifics
  items: string;
  addItem: string;
  itemName: string;
  unitPrice: string;
  quantity: string;
  subtotal: string;
  assignees: string;
  chargesAndDiscounts: string;
  addCharge: string;
  tax: string;
  serviceCharge: string;
  tip: string;
  discount: string;
  adjustment: string;
  receiptTotal: string;
  receiptMismatchWarning: string;
  liveBreakdown: string;
  selectAll: string;
  selectNone: string;
  selectFamily: string;
  whoOwesWhat: string;
  owesNothing: string;
  // Repayments & Ledger
  ledger: string;
  repayments: string;
  recordRepayment: string;
  settleUp: string;
  suggestedSettlements: string;
  allSettled: string;
  unsettled: string;
  owes: string;
  receives: string;
  repaymentAmount: string;
  reference: string;
  note: string;
  allowAdvance: string;
  // Reports & Maps
  reportsAndAnalytics: string;
  totalSpent: string;
  budgetRemaining: string;
  overBudget: string;
  categoryBreakdown: string;
  destinationMap: string;
  noMapCoords: string;
  // Notifications
  notifications: string;
  noNotifications: string;
  markAsRead: string;
  markAllAsRead: string;
  unread: string;
  allNotifications: string;
  notificationPreferences: string;
  tripNotifications: string;
  expenseNotifications: string;
  repaymentNotifications: string;
  browserNotifications: string;
  enableBrowserPush: string;
  browserPushEnabledDesc: string;
  // Super Admin
  superAdmin: string;
  adminPortal: string;
  adminDashboard: string;
  adminLoginTitle: string;
  adminLoginDesc: string;
  overview: string;
  familyManagement: string;
  memberManagement: string;
  tripManagement: string;
  expenseManagement: string;
  recentActivity: string;
  totalRegisteredUsers: string;
  activeMemberships: string;
  outstandingBalances: string;
  activateAccount: string;
  deactivateAccount: string;
  accountActive: string;
  accountDeactivated: string;
  voidExpense: string;
  // Landing Page & Hero
  heroBadge: string;
  heroHeadline: string;
  heroSubtitle: string;
  signIn: string;
  register: string;
  haveInviteCode: string;
  featureOriginalPhotos: string;
  featureFairSplits: string;
  featureAllTrips: string;
  ammammaQuote: string;
  ammammaLocation: string;
  // Auth Screen
  welcomeBack: string;
  welcomeSubtitle: string;
  joinFamily: string;
  joinFamilySubtitle: string;
  initialSetupMode: string;
  initialSetupDesc: string;
  invitationCode: string;
  fullName: string;
  email: string;
  password: string;
  standardFamilyLogin: string;
  completeSetupLaunch: string;
  registerAndJoinTrip: string;
  quickSignInHelper: string;
  rememberedOnDevice: string;
  removeAccount: string;
  useDifferentAccount: string;
  privateSecurityFooter: string;
  selectRememberedAccount: string;
  passwordRequiredForLogin: string;
  // Admin: Family Invite Codes
  familyInviteCodes: string;
  createInviteCode: string;
  inviteCode: string;
  targetFamily: string;
  allowCreateFamily: string;
  maxUses: string;
  usesCount: string;
  remainingUses: string;
  expiresAt: string;
  codeStatus: string;
  active: string;
  revoked: string;
  exhausted: string;
  revokeCode: string;
  revokeConfirm: string;
  customCodePlaceholder: string;
  generateRandomCode: string;
  noInviteCodes: string;
  inviteCodeCreated: string;
  inviteCodeRevoked: string;
  // Admin: User Management & Removal
  removeUser: string;
  removeUserDialogTitle: string;
  removeUserExplanation: string;
  deactivateAction: string;
  deleteAction: string;
  confirmRemoveUser: string;
  cannotRemoveSelf: string;
  cannotRemoveLastAdmin: string;
  userRole: string;
  userStatus: string;
  // Map Route Planning & Offline
  plannedRoute: string;
  visitingPlaces: string;
  addPlace: string;
  placeName: string;
  latitude: string;
  longitude: string;
  notes: string;
  moveUp: string;
  moveDown: string;
  removePlace: string;
  prepareOffline: string;
  offlineReady: string;
  offlineFallbackTitle: string;
  offlineFallbackDesc: string;
  offlineNotice: string;
  preparingMap: string;
  // Expense Wizard Validation & UI
  expenseAmountMustBePositive: string;
  enterValidTitle: string;
  selectAtLeastOneParticipant: string;
  whoPaid: string;
  participatingMembers: string;
  finalBreakdown: string;
  remainderSharedEqually: string;
  eachOwes: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    appName: 'TripMates',
    tagline: 'Private Family Trips & Itemized Expense Manager',
    dashboard: 'Dashboard',
    trips: 'Trips',
    expenses: 'Expenses',
    settlements: 'Settlements',
    reports: 'Reports',
    families: 'Families',
    auditLog: 'Audit Log',
    login: 'Login',
    logout: 'Logout',
    setupAdmin: 'Setup Administrator',
    language: 'Language',
    loading: 'Loading...',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    confirm: 'Confirm',
    edit: 'Edit',
    close: 'Close',
    back: 'Back',
    actions: 'Actions',
    viewDetails: 'View Details',
    activeTrips: 'Active Trips',
    createTrip: 'Create Trip',
    newTrip: 'New Trip',
    tripName: 'Trip Name',
    destination: 'Destination',
    dates: 'Dates',
    budget: 'Budget',
    status: 'Status',
    privateTrip: 'Private Trip (Restricted after completion)',
    planning: 'Planning',
    upcoming: 'Upcoming',
    ongoing: 'Ongoing',
    completed: 'Completed',
    markCompleted: 'Mark as Completed',
    participants: 'Participants',
    attendance: 'Attendance',
    rsvpComing: 'Coming',
    rsvpNotComing: 'Not Coming',
    rsvpPending: 'Pending',
    myRsvp: 'My RSVP',
    updateAttendance: 'Update Attendance',
    attendanceHistory: 'Attendance History',
    addExpense: 'Add Expense',
    itemizedBill: 'Itemized Bill',
    quickSplit: 'Split Expense',
    expenseTitle: 'Expense Title',
    expenseDate: 'Date',
    category: 'Category',
    paidBy: 'Paid By',
    totalAmount: 'Total Amount',
    splitMethod: 'Split Method',
    equalSplit: 'Equal Split',
    perHeadSplit: 'Per-Head (Rate × Heads)',
    customSplit: 'Custom Amount',
    percentageSplit: 'Percentage Split',
    familyWiseSplit: 'Family-Wise',
    mixedSplit: 'Mixed (Individual & Families)',
    individualRemainderSplit: 'Individual Amount + Equal Shared Remainder',
    individualPortion: 'Individual Portion (₹)',
    individualTotal: 'Individual Total',
    sharedRemainder: 'Shared Remainder',
    equalRemainderShare: 'Equal Remainder Share',
    items: 'Items',
    addItem: 'Add Item',
    itemName: 'Item Name',
    unitPrice: 'Unit Price (₹)',
    quantity: 'Quantity',
    subtotal: 'Subtotal',
    assignees: 'Who Shared This?',
    chargesAndDiscounts: 'Taxes, Tips & Discounts',
    addCharge: 'Add Charge / Discount',
    tax: 'Tax (GST/VAT)',
    serviceCharge: 'Service Charge',
    tip: 'Tip',
    discount: 'Discount',
    adjustment: 'Adjustment',
    receiptTotal: 'Receipt Total (Optional)',
    receiptMismatchWarning: 'Receipt Mismatch Warning',
    liveBreakdown: 'Live Share Breakdown',
    selectAll: 'Select All',
    selectNone: 'Select None',
    selectFamily: 'Select Family',
    whoOwesWhat: 'Who Owes What',
    owesNothing: 'Owes ₹0',
    ledger: 'Group Ledger',
    repayments: 'Repayments',
    recordRepayment: 'Record Repayment',
    settleUp: 'Settle Up',
    suggestedSettlements: 'Suggested Settlements',
    allSettled: 'All balances are settled!',
    unsettled: 'Pending balances to settle',
    owes: 'Owes',
    receives: 'Receives',
    repaymentAmount: 'Repayment Amount (₹)',
    reference: 'Reference (e.g. UPI Ref / Cash)',
    note: 'Note',
    allowAdvance: 'Allow Advance Payment',
    reportsAndAnalytics: 'Reports & Analytics',
    totalSpent: 'Total Spent',
    budgetRemaining: 'Budget Remaining',
    overBudget: 'Over Budget',
    categoryBreakdown: 'Spending by Category',
    destinationMap: 'Destination Map',
    noMapCoords: 'Interactive destination map powered by OpenStreetMap',
    // Notifications
    notifications: 'Notifications',
    noNotifications: 'No notifications yet',
    markAsRead: 'Mark as read',
    markAllAsRead: 'Mark all as read',
    unread: 'Unread',
    allNotifications: 'All',
    notificationPreferences: 'Notification Settings',
    tripNotifications: 'Trip Updates & Invitations',
    expenseNotifications: 'Expense & Share Updates',
    repaymentNotifications: 'Repayment Receipts',
    browserNotifications: 'Browser Notifications',
    enableBrowserPush: 'Enable browser notifications for live alerts',
    browserPushEnabledDesc: 'Get instant notifications on this device without sharing your details with external services.',
    // Super Admin
    superAdmin: 'Super Admin',
    adminPortal: 'Super Admin Portal',
    adminDashboard: 'Super Admin Dashboard',
    adminLoginTitle: 'Administrative Access',
    adminLoginDesc: 'Private system management restricted strictly to designated Super Administrators.',
    overview: 'Overview',
    familyManagement: 'Families',
    memberManagement: 'Members & Users',
    tripManagement: 'All Trips',
    expenseManagement: 'Expenses & Settlements',
    recentActivity: 'Recent System Activity',
    totalRegisteredUsers: 'Total Registered Users',
    activeMemberships: 'Active Memberships',
    outstandingBalances: 'Outstanding Balances',
    activateAccount: 'Activate Account',
    deactivateAccount: 'Deactivate Account',
    accountActive: 'Active',
    accountDeactivated: 'Deactivated',
    voidExpense: 'Void Expense',
    // Landing Page & Hero
    heroBadge: 'Private · family invitation only',
    heroHeadline: 'Every trip, every photo, every rupee — together.',
    heroSubtitle: 'Plan our next getaway, keep photos in full original quality, and settle up fairly without the spreadsheet.',
    signIn: 'Sign in',
    register: 'Register',
    haveInviteCode: 'I have an invite code',
    featureOriginalPhotos: 'Original photos',
    featureFairSplits: 'Fair splits',
    featureAllTrips: 'All our trips',
    ammammaQuote: '"The houseboat morning — Ammamma still talks about it."',
    ammammaLocation: 'Kerala Backwaters · April 2026',
    // Auth Screen
    welcomeBack: 'Welcome back',
    welcomeSubtitle: 'Sign in to see our trips, photos and balances.',
    joinFamily: 'Join our family',
    joinFamilySubtitle: 'Enter your invitation code to access your family trips.',
    initialSetupMode: 'Initial Setup Mode',
    initialSetupDesc: 'Create your Super Administrator credentials to manage families, trips, and system access.',
    invitationCode: 'Invitation Code',
    fullName: 'Full Name',
    email: 'Email',
    password: 'Password',
    standardFamilyLogin: 'Standard family login',
    completeSetupLaunch: 'Complete Setup & Launch',
    registerAndJoinTrip: 'Register & Join Trip',
    quickSignInHelper: 'Quick Sign-In Helper',
    rememberedOnDevice: 'Remembered on this device',
    removeAccount: 'Remove',
    useDifferentAccount: 'Use another account',
    privateSecurityFooter: 'Only invited family members can join. Photos and expenses are visible only to people on each trip.',
    selectRememberedAccount: 'Select your remembered account and enter password to sign in.',
    passwordRequiredForLogin: 'Password is required to authenticate securely.',
    // Admin: Family Invite Codes
    familyInviteCodes: 'Family Invite Codes',
    createInviteCode: 'Create Invite Code',
    inviteCode: 'Invite Code',
    targetFamily: 'Target Family',
    allowCreateFamily: 'Allow New Family Creation (Unassigned)',
    maxUses: 'Maximum Uses',
    usesCount: 'Uses Count',
    remainingUses: 'Remaining Uses',
    expiresAt: 'Expires At',
    codeStatus: 'Status',
    active: 'Active',
    revoked: 'Revoked',
    exhausted: 'Exhausted',
    revokeCode: 'Revoke Code',
    revokeConfirm: 'Are you sure you want to revoke this invite code? Future registrations with this code will be rejected.',
    customCodePlaceholder: 'e.g. SUMMER-2026 or leave blank for auto-generated',
    generateRandomCode: 'Auto-generate secure code',
    noInviteCodes: 'No invite codes created yet.',
    inviteCodeCreated: 'Family invite code generated successfully.',
    inviteCodeRevoked: 'Invite code revoked.',
    // Admin: User Management & Removal
    removeUser: 'Remove User',
    removeUserDialogTitle: 'Remove or Deactivate User',
    removeUserExplanation: 'To protect financial records and audit history, accounts with recorded expenses, allocations, or repayments cannot be deleted. Instead, they will be deactivated and all active sessions immediately revoked.',
    deactivateAction: 'Deactivate Account (Preserve Financial History)',
    deleteAction: 'Permanently Delete (Only if zero financial history)',
    confirmRemoveUser: 'Confirm User Action',
    cannotRemoveSelf: 'You cannot remove your own administrative account.',
    cannotRemoveLastAdmin: 'Cannot remove the last remaining Super Administrator.',
    userRole: 'Role',
    userStatus: 'Account Status',
    // Map Route Planning & Offline
    plannedRoute: 'Planned Route & Itinerary',
    visitingPlaces: 'Visiting Places',
    addPlace: 'Add Place',
    placeName: 'Place Name',
    latitude: 'Latitude',
    longitude: 'Longitude',
    notes: 'Notes / Time',
    moveUp: 'Move Up',
    moveDown: 'Move Down',
    removePlace: 'Remove Place',
    prepareOffline: 'Prepare for Offline',
    offlineReady: 'Route and places cached for offline access',
    offlineFallbackTitle: 'Offline Trip Itinerary',
    offlineFallbackDesc: 'You are currently offline or map imagery is unavailable. All saved places and itinerary order are displayed below.',
    offlineNotice: 'Map tiles are cached according to browser storage limits. OpenStreetMap tile policy prohibits aggressive bulk scraping.',
    preparingMap: 'Caching route and place data locally...',
    // Expense Wizard Validation & UI
    expenseAmountMustBePositive: 'Please enter an expense amount greater than ₹0.',
    enterValidTitle: 'Please enter a description or title for the expense.',
    selectAtLeastOneParticipant: 'Please select at least one participating member.',
    whoPaid: 'Who paid?',
    participatingMembers: 'Who participated in this expense?',
    finalBreakdown: 'Final Share Breakdown',
    remainderSharedEqually: 'Equal shared remainder among selected members',
    eachOwes: 'owes',
  },
  te: {
    appName: 'ట్రిప్‌మేట్స్',
    tagline: 'కుటుంబ ప్రైవేట్ యాత్రలు మరియు ఖర్చుల విభజన',
    dashboard: 'డాష్‌బోర్డ్',
    trips: 'యాత్రలు',
    expenses: 'ఖర్చులు',
    settlements: 'చెల్లింపుల లెక్కలు',
    reports: 'నివేదికలు',
    families: 'కుటుంబాలు',
    auditLog: 'ఆడిట్ లాగ్',
    login: 'లాగిన్',
    logout: 'లాగౌట్',
    setupAdmin: 'సూపర్ అడ్మిన్ ఏర్పాటు',
    language: 'భాష',
    loading: 'లోడ్ అవుతోంది...',
    save: 'భద్రపరచు',
    cancel: 'రద్దు',
    delete: 'తొలగించు',
    confirm: 'నిర్ధారించు',
    edit: 'సవరించు',
    close: 'మూసివేయి',
    back: 'వెనుకకు',
    actions: 'చర్యలు',
    viewDetails: 'వివరాలు చూడండి',
    activeTrips: 'ప్రస్తుత యాత్రలు',
    createTrip: 'కొత్త యాత్ర ప్రారంభించు',
    newTrip: 'కొత్త యాత్ర',
    tripName: 'యాత్ర పేరు',
    destination: 'గమ్యస్థానం',
    dates: 'తేదీలు',
    budget: 'బడ్జెట్',
    status: 'స్థితి',
    privateTrip: 'ప్రైవేట్ యాత్ర (పూర్తయిన తర్వాత పరిమిత ప్రాప్యత)',
    planning: 'ప్రణాళిక',
    upcoming: 'రాబోయేది',
    ongoing: 'కొనసాగుతోంది',
    completed: 'పూర్తయింది',
    markCompleted: 'పూర్తయినట్లు గుర్తించు',
    participants: 'పాల్గొనేవారు',
    attendance: 'హాజరు',
    rsvpComing: 'వస్తున్నాను',
    rsvpNotComing: 'రాలేను',
    rsvpPending: 'నిర్ణయించలేదు',
    myRsvp: 'నా హాజరు',
    updateAttendance: 'హాజరు నమోదు చేయండి',
    attendanceHistory: 'హాజరు చరిత్ర',
    addExpense: 'ఖర్చు చేర్చండి',
    itemizedBill: 'వస్తువుల వారీ బిల్లు',
    quickSplit: 'ఖర్చు విభజన',
    expenseTitle: 'ఖర్చు పేరు',
    expenseDate: 'తేదీ',
    category: 'వర్గం',
    paidBy: 'ఎవరు చెల్లించారు',
    totalAmount: 'మొత్తం మొత్తం',
    splitMethod: 'విభజన విధానం',
    equalSplit: 'సమాన విభజన',
    perHeadSplit: 'తలసరి (ధర × సంఖ్య)',
    customSplit: 'అనుకూల మొత్తం',
    percentageSplit: 'శాతం వారీగా',
    familyWiseSplit: 'కుటుంబాల వారీగా',
    mixedSplit: 'మిశ్రమ (కుటుంబం + వ్యక్తులు)',
    individualRemainderSplit: 'వ్యక్తిగత మొత్తం + సమాన మిగిలిన వాటా',
    individualPortion: 'వ్యక్తిగత వాటా (₹)',
    individualTotal: 'మొత్తం వ్యక్తిగత వాటా',
    sharedRemainder: 'మిగిలిన ఉమ్మడి మొత్తం',
    equalRemainderShare: 'సమాన మిగులు వాటా',
    items: 'వస్తువులు',
    addItem: 'వస్తువును చేర్చండి',
    itemName: 'వస్తువు పేరు',
    unitPrice: 'ఒకటి ధర (₹)',
    quantity: 'సంఖ్య / ప్లేట్లు',
    subtotal: 'మొత్తం',
    assignees: 'ఎవరెవరు తిన్నారు / పంచుకున్నారు?',
    chargesAndDiscounts: 'పన్నులు, టిప్ & తగ్గింపులు',
    addCharge: 'రుసుము / తగ్గింపు చేర్చండి',
    tax: 'పన్ను (GST/VAT)',
    serviceCharge: 'సర్వీస్ ఛార్జ్',
    tip: 'టిప్',
    discount: 'తగ్గింపు (Discount)',
    adjustment: 'సర్దుబాటు',
    receiptTotal: 'రశీదు మొత్తం (ఐచ్ఛికం)',
    receiptMismatchWarning: 'రశీదు వ్యత్యాస హెచ్చరిక',
    liveBreakdown: 'ప్రత్యక్ష వాటాల వివరాలు',
    selectAll: 'అందరినీ ఎంచుకోండి',
    selectNone: 'ఎవరినీ వద్దు',
    selectFamily: 'కుటుంబాన్ని ఎంచుకోండి',
    whoOwesWhat: 'ఎవరు ఎంత చెల్లించాలి',
    owesNothing: 'బాకీ లేదు (₹0)',
    ledger: 'యాత్ర లెక్కల పుస్తకం',
    repayments: 'తిరిగి చెల్లింపులు',
    recordRepayment: 'చెల్లింపు నమోదు చేయండి',
    settleUp: 'లెక్క తేల్చండి',
    suggestedSettlements: 'సూచించిన బదిలీలు',
    allSettled: 'అన్ని లెక్కలు పూర్తయ్యాయి!',
    unsettled: 'చెల్లించాల్సిన బాకీలు ఉన్నాయి',
    owes: 'బాకీ ఉంది',
    receives: 'రావాల్సి ఉంది',
    repaymentAmount: 'చెల్లింపు మొత్తం (₹)',
    reference: 'రిఫరెన్స్ (UPI / నగదు)',
    note: 'గమనిక',
    allowAdvance: 'ముందస్తు చెల్లింపుకు అనుమతించు',
    reportsAndAnalytics: 'నివేదికలు & విశ్లేషణ',
    totalSpent: 'మొత్తం ఖర్చు',
    budgetRemaining: 'మిగిలిన బడ్జెట్',
    overBudget: 'బడ్జెట్ మించింది',
    categoryBreakdown: 'వర్గాల వారీ ఖర్చులు',
    destinationMap: 'గమ్యస్థాన మ్యాప్',
    noMapCoords: 'OpenStreetMap ద్వారా ప్రత్యక్ష మ్యాప్',
    // Notifications
    notifications: 'నోటిఫికేషన్లు',
    noNotifications: 'ఇంకా ఎటువంటి నోటిఫికేషన్లు లేవు',
    markAsRead: 'చదివినట్లుగా గుర్తించు',
    markAllAsRead: 'అన్నీ చదివినట్లుగా గుర్తించు',
    unread: 'చదవనివి',
    allNotifications: 'అన్నీ',
    notificationPreferences: 'నోటిఫికేషన్ అమరికలు',
    tripNotifications: 'యాత్రల ఆహ్వానాలు & సమాచారం',
    expenseNotifications: 'ఖర్చులు & వాటాల వివరాలు',
    repaymentNotifications: 'తిరిగి చెల్లింపుల రశీదులు',
    browserNotifications: 'బ్రౌజర్ నోటిఫికేషన్లు',
    enableBrowserPush: 'బ్రౌజర్ నోటిఫికేషన్లను ప్రారంభించండి',
    browserPushEnabledDesc: 'వెబ్‌సైట్ మూసివేసినప్పటికీ వెంటనే హెచ్చరికలను పొందండి.',
    // Super Admin
    superAdmin: 'సూపర్ అడ్మిన్',
    adminPortal: 'సూపర్ అడ్మిన్ పోర్టల్',
    adminDashboard: 'సూపర్ అడ్మిన్ డాష్‌బోర్డ్',
    adminLoginTitle: 'సిస్టమ్ అడ్మిన్ ప్రవేశం',
    adminLoginDesc: 'సూపర్ అడ్మినిస్ట్రేటర్‌ల కోసం మాత్రమే ప్రత్యేకంగా కేటాయించబడింది.',
    overview: 'సమీక్ష',
    familyManagement: 'కుటుంబాలు',
    memberManagement: 'సభ్యులు & ఖాతాలు',
    tripManagement: 'అన్ని యాత్రలు',
    expenseManagement: 'ఖర్చులు & సెటిల్‌మెంట్లు',
    recentActivity: 'ఇటీవలి సిస్టమ్ కార్యకలాపాలు',
    totalRegisteredUsers: 'మొత్తం నమోదైన ఖాతాలు',
    activeMemberships: 'క్రియాశీల సభ్యత్వాలు',
    outstandingBalances: 'చెల్లించాల్సిన మొత్తం బాకీలు',
    activateAccount: 'ఖాతాను పునరుద్ధరించు',
    deactivateAccount: 'ఖాతాను నిలిపివేయి',
    accountActive: 'క్రియాశీలం',
    accountDeactivated: 'నిలిపివేయబడింది',
    voidExpense: 'ఖర్చును రద్దు చేయి',
    // Landing Page & Hero
    heroBadge: 'ప్రైవేట్ · కుటుంబ ఆహ్వానంతో మాత్రమే',
    heroHeadline: 'ప్రతి ప్రయాణం, ప్రతి ఫోటో, ప్రతి రూపాయి — కలిసికట్టుగా.',
    heroSubtitle: 'మన తదుపరి విహారాన్ని ప్లాన్ చేయండి, ఫోటోలను ఒరిజినల్ క్వాలిటీలో దాచుకోండి, మరియు లెక్కలను న్యాయంగా పరిష్కరించుకోండి.',
    signIn: 'లాగిన్ చేయండి',
    register: 'నమోదు చేసుకోండి',
    haveInviteCode: 'నా దగ్గర ఆహ్వాన కోడ్ ఉంది',
    featureOriginalPhotos: 'అసలైన ఫోటోలు',
    featureFairSplits: 'న్యాయమైన లెక్కలు',
    featureAllTrips: 'మన అన్ని ప్రయాణాలు',
    ammammaQuote: '"ఆ హౌస్‌బోట్ ఉదయం — అమ్మమ్మ ఇప్పటికీ దాని గురించే మాట్లాడుతుంది."',
    ammammaLocation: 'కేరళ బ్యాక్‌వాటర్స్ · ఏప్రిల్ 2026',
    // Auth Screen
    welcomeBack: 'మళ్ళీ స్వాగతం',
    welcomeSubtitle: 'మన ప్రయాణాలు, ఫోటోలు మరియు బ్యాలెన్సులను చూడటానికి లాగిన్ అవ్వండి.',
    joinFamily: 'మా కుటుంబంలో చేరండి',
    joinFamilySubtitle: 'మీ కుటుంబ ప్రయాణాలను చూడటానికి మీ ఆహ్వాన కోడ్‌ను నమోదు చేయండి.',
    initialSetupMode: 'ప్రారంభ సెటప్ మోడ్',
    initialSetupDesc: 'కుటుంబాలు, ప్రయాణాలు మరియు సిస్టమ్ యాక్సెస్‌ను నిర్వహించడానికి మీ సూపర్ అడ్మినిస్ట్రేటర్ ఆధారాలను సృష్టించండి.',
    invitationCode: 'ఆహ్వాన కోడ్',
    fullName: 'పూర్తి పేరు',
    email: 'ఈమెయిల్',
    password: 'పాస్‌వర్డ్',
    standardFamilyLogin: 'సాధారణ కుటుంబ లాగిన్',
    completeSetupLaunch: 'సెటప్ పూర్తి చేసి ప్రారంభించండి',
    registerAndJoinTrip: 'నమోదు చేసుకుని ప్రయాణంలో చేరండి',
    quickSignInHelper: 'త్వరిత లాగిన్ సహాయకం',
    rememberedOnDevice: 'ఈ పరికరంలో గుర్తుంచుకోబడింది',
    removeAccount: 'తొలగించు',
    useDifferentAccount: 'మరొక ఖాతాను ఉపయోగించండి',
    privateSecurityFooter: 'ఆహ్వానించబడిన కుటుంబ సభ్యులు మాత్రమే చేరగలరు. ఫోటోలు మరియు ఖర్చులు ప్రతి ప్రయాణంలో ఉన్నవారికి మాత్రమే కనిపిస్తాయి.',
    selectRememberedAccount: 'గుర్తుంచుకున్న ఖాతాను ఎంచుకుని పాస్‌వర్డ్ నమోదు చేసి లాగిన్ అవ్వండి.',
    passwordRequiredForLogin: 'సురక్షితంగా ధృవీకరించడానికి పాస్‌వర్డ్ తప్పనిసరి.',
    // Admin: Family Invite Codes
    familyInviteCodes: 'కుటుంబ ఆహ్వాన కోడ్‌లు',
    createInviteCode: 'ఆహ్వాన కోడ్‌ను సృష్టించండి',
    inviteCode: 'ఆహ్వాన కోడ్',
    targetFamily: 'లక్ష్య కుటుంబం',
    allowCreateFamily: 'కొత్త కుటుంబాన్ని సృష్టించడానికి అనుమతించు',
    maxUses: 'గరిష్ట ఉపయోగాలు',
    usesCount: 'ఉపయోగించిన సంఖ్య',
    remainingUses: 'మిగిలిన ఉపయోగాలు',
    expiresAt: 'గడువు ముగింపు తేదీ',
    codeStatus: 'స్థితి',
    active: 'క్రియాశీలం',
    revoked: 'రద్దు చేయబడింది',
    exhausted: 'పూర్తయింది',
    revokeCode: 'కోడ్‌ను రద్దు చేయండి',
    revokeConfirm: 'మీరు ఖచ్చితంగా ఈ ఆహ్వాన కోడ్‌ను రద్దు చేయాలనుకుంటున్నారా? ఇకపై ఎవరూ దీనితో నమోదు చేసుకోలేరు.',
    customCodePlaceholder: 'ఉదా. SUMMER-2026 లేదా ఆటోమేటిక్ కోడ్ కోసం ఖాళీగా ఉంచండి',
    generateRandomCode: 'సురక్షిత కోడ్‌ను ఆటోమేటిక్‌గా రూపొందించు',
    noInviteCodes: 'ఇంకా ఆహ్వాన కోడ్‌లు సృష్టించబడలేదు.',
    inviteCodeCreated: 'కుటుంబ ఆహ్వాన కోడ్ విజయవంతంగా సృష్టించబడింది.',
    inviteCodeRevoked: 'ఆహ్వాన కోడ్ రద్దు చేయబడింది.',
    // Admin: User Management & Removal
    removeUser: 'వినియోగదారుని తొలగించండి',
    removeUserDialogTitle: 'వినియోగదారుని తొలగించండి లేదా నిష్క్రియం చేయండి',
    removeUserExplanation: 'ఖర్చుల రికార్డులు, చెల్లింపులు లేదా హాజరు ఉన్న వినియోగదారుల ఆర్థిక చరిత్ర మరియు ఆడిట్ సమగ్రతను రక్షించడానికి, వారిని పూర్తిగా తొలగించలేము. బదులుగా, వారి ఖాతా నిష్క్రియం చేయబడుతుంది మరియు అన్ని సెషన్‌లు రద్దు చేయబడతాయి.',
    deactivateAction: 'ఖాతాను నిలిపివేయి (ఆర్థిక రికార్డులు భద్రపరుచు)',
    deleteAction: 'శాశ్వతంగా తొలగించు (ఆర్థిక చరిత్ర లేనప్పుడు మాత్రమే)',
    confirmRemoveUser: 'చర్యను నిర్ధారించండి',
    cannotRemoveSelf: 'మీరు మీ స్వంత ఖాతాను తొలగించలేరు.',
    cannotRemoveLastAdmin: 'ఒకే ఒక్క మిగిలిన సూపర్ అడ్మినిస్ట్రేటర్‌ను తొలగించలేరు.',
    userRole: 'పాత్ర',
    userStatus: 'ఖాతా స్థితి',
    // Map Route Planning & Offline
    plannedRoute: 'ప్రణాళికాబద్ధమైన మార్గం & ప్రదేశాలు',
    visitingPlaces: 'సందర్శించే ప్రదేశాలు',
    addPlace: 'ప్రదేశాన్ని జోడించండి',
    placeName: 'ప్రదేశం పేరు',
    latitude: 'అక్షాంశం',
    longitude: 'రేఖాంశం',
    notes: 'గమనికలు / సమయం',
    moveUp: 'పైకి జరపండి',
    moveDown: 'కిందికి జరపండి',
    removePlace: 'ప్రదేశాన్ని తొలగించండి',
    prepareOffline: 'ఆఫ్‌లైన్ కోసం సిద్ధం చేయండి',
    offlineReady: 'ఆఫ్‌లైన్ ఉపయోగం కోసం రూట్ కాష్ చేయబడింది',
    offlineFallbackTitle: 'ఆఫ్‌లైన్ ప్రయాణ ప్రణాళిక',
    offlineFallbackDesc: 'ఇంటర్నెట్ కనెక్షన్ లేకుండా మ్యాప్ టైల్స్ అందుబాటులో లేవు. మీ కాష్ చేయబడిన ప్రయాణ ప్రణాళిక మరియు మార్గ క్రమం ఇక్కడ ఉంది.',
    offlineNotice: 'బ్రౌజర్ నిల్వ పరిమితులకు లోబడి మ్యాప్ కాష్ చేయబడుతుంది. OpenStreetMap వినియోగ నిబంధనలకు కట్టుబడి ఉంది.',
    preparingMap: 'మార్గాన్ని స్థానికంగా భద్రపరుస్తోంది...',
    // Expense Wizard Validation & UI
    expenseAmountMustBePositive: 'దయచేసి ₹0 కంటే ఎక్కువ ఖర్చు మొత్తాన్ని నమోదు చేయండి.',
    enterValidTitle: 'దయచేసి ఖర్చుకు శీర్షిక లేదా వివరాలను నమోదు చేయండి.',
    selectAtLeastOneParticipant: 'దయచేసి కనీసం ఒక సభ్యుడిని ఎంచుకోండి.',
    whoPaid: 'ఎవరు చెల్లించారు?',
    participatingMembers: 'ఈ ఖర్చులో ఎవరు పాల్గొన్నారు?',
    finalBreakdown: 'తుది వాటాల వివరాలు',
    remainderSharedEqually: 'ఎంచుకున్న సభ్యుల మధ్య సమానంగా పంచుకున్న మిగులు వాటా',
    eachOwes: 'బాకీ మొత్తం',
  },
};
