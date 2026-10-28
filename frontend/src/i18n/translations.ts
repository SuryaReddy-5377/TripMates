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
  },
};
