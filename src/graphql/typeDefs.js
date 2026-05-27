// src/graphql/typeDefs.js

import { gql } from "graphql-tag";

const typeDefs = gql`
  scalar JSON
  scalar Upload
  enum Gender {
    MALE
    FEMALE
    OTHER
  }

  enum AdminRole {
    SUPER_ADMIN
    SUB_ADMIN
    MANAGER
    SUPPORT
  }

  type MessageResponse {
    message: String!
  }

  enum ApprovalStatus {
    PENDING
    INTERVIEW
    DOCUMENT_VERIFICATION
    APPROVED
    REJECTED
  }

  enum InterviewStatus {
    SCHEDULED
    PASSED
    FAILED
    RESCHEDULED
  }

  enum DocumentStatus {
    PENDING
    VERIFIED
    REJECTED
  }

  enum DocumentType {
    AADHAAR
    PAN
    PASSBOOK
    PROFILE
  }

  enum SortOrder {
    ASC
    DESC
  }

  enum AstrologerSortField {
    EXPERIENCE
    PRICE
    RATING
  }

  input AstrologerSearchInput {
    query: String # search by name, skills, languages, etc.
    sortField: AstrologerSortField
    sortOrder: SortOrder
    limit: Int
    page: Int
  }

  type AstrologerList {
    data: [Astrologer!]!
    totalCount: Int!
    currentPage: Int!
    totalPages: Int!
  }
  scalar DateTime
  type User {
    id: ID!
    name: String
    mobile: String
    gender: Gender
    birthDate: String
    birthTime: DateTime
    occupation: String
    isActive: Boolean
    isDeleted: Boolean
    createdAt: DateTime
    updatedAt: DateTime
    userCoins: Float
    lockedCoins: Float
    wallet: UserWallet
  }

  #--------------------------------------#
  input PricingInput {
    type: PricingType!
    price: Float!
    offerPrice: Float
    commissionPercent: Float
    isActive: Boolean!
  }

  input AddAstrologerInput {
    astroname: String!
    displayName: String!
    gender: Gender!
    email: String!
    phoneNumber: String!
    experience: Int!
    status: Boolean 

    profilePic: String
    expertise: [String!]!
    languages: [String!]!
    problems: [String!]!

    about: String

    tags: String
    vtags: String

    address: AddressInput

    bankDetails: BankDetailsInput
    documents: DocumentsInput

    pricing: [PricingInput!]!
  }

  type Astrologer {
    id: ID!
    name: String!
    displayName: String!
    profilePic: String
    gender: Gender!

    email: String!
    contactNo: String!
    experience: Int!

    about: String

    languages: [String!]!
    skills: [String!]!
    problems: [String!]!

    pricing: [AstrologerPricing!]!

    tags: String
    vtags: String

    approvalStatus: ApprovalStatus!

    addresses: [Address!]!
    experiences: [ExperiencePlatform!]!
    interviews: [Interview!]!

    createdAt: DateTime
    updatedAt: DateTime
  }

  type Address {
    street: String!
    city: String!
    state: String!
    country: String!
    pincode: String!
  }

  type ExperiencePlatform {
    platformName: String!
    yearsWorked: Int!
  }

  type Interview {
    id: ID!
    roundNumber: Int
    interviewerName: String
    scheduledAt: String
    status: InterviewStatus
    remarks: String
  }

  type AstrologerRejectionHistory {
    id: ID!
    stage: String
    reason: String
    rejectedBy: String
    createdAt: DateTime
  }

  type Admin {
    id: ID!
    name: String!
    email: String!
    phoneNo: String!
    role: Role!
  }
  type Staff {
    id: ID!
    name: String!
    email: String!
    role: Role
  }

  type AdminAuthPayload {
    admin: Admin!
    accessToken: String!
    refreshToken: String!
  }

  type AuthPayload {
    user: Staff!
    accessToken: String!
    refreshToken: String!
  }

  type PaginatedAstrologers {
    data: [Astrologer!]!
    totalCount: Int!
    currentPage: Int!
    totalPages: Int!
  }

  input UserSearchInput {
    query: String
    mobile: String
    filterType: String # TODAY | WEEK | MONTH | YEAR | CUSTOM
    startDate: String
    endDate: String
    page: Int
    limit: Int
  }

  type UserList {
    data: [User!]!
    totalCount: Int!
    currentPage: Int!
    totalPages: Int!
  }

  type PaginatedInterviews {
    data: [Interview!]!
    totalCount: Int!
    currentPage: Int!
    totalPages: Int!
  }

  input AddressInput {
    street: String!
    city: String!
    state: String!
    country: String!
    pincode: String!
  }

  input ExperiencePlatformInput {
    platformName: String!
    yearsWorked: Int!
  }

  input RegisterAstrologerInput {
    profilePic: String!
    name: String!
    dateOfBirth: String!
    gender: Gender!
    languages: [String!]!
    skills: [String!]!
    experience: Int!
    email: String!
    contactNo: String!
    about: String!
    addresses: [AddressInput!]!
    experiences: [ExperiencePlatformInput!]!
  }
  type AdminPagination {
    data: [Admin!]!
    totalCount: Int!
    currentPage: Int!
    totalPages: Int!
  }
  #-----------------------------START OF RECHARGE PACKS-------------#
  input RechargePackInput {
    name: String!
    description: String
    price: Float!
    talktime: Int!
    coins: Int!
    validityDays: Int!
    isActive: Boolean
  }

  type RechargePack {
    id: ID!
    name: String!
    description: String
    price: Float!
    talktime: Int!
    coins: Int!
    validityDays: Int!
    isActive: Boolean!
    createdAt: DateTime
    updatedAt: DateTime
  }

  input UpdateRechargePackInput {
    name: String
    description: String
    price: Float
    coins: Int
    talktime: Int
    validityDays: Int
    isActive: Boolean
  }

  #-----------END OF RECHARGE PACKS-----------------#

  #------------Coupon ____------------------------_#
  input CreateCouponInput {
    code: String!
    description: String
    applicable: String
    type: String!
    status: String!
    visibility: String!
    percentage: Float
    max_discount: Float
    redeem_limit: Int
    start_date: String!
    end_date: String!
  }

  type Coupon {
    id: ID!
    code: String!
    description: String
    applicable: String
    type: String!
    status: String!
    visibility: String!
    percentage: Float
    max_discount: Float
    redeem_limit: Int
    start_date: String!
    end_date: String!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  #-----------------------------START Wallet MANAGEMENT-----------------#
  type Wallet {
    id: ID!
    name: String!
    description: String
    coins: Int!
    price: Float!
    isActive: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type UserWallet {
    id: ID!
    userId: ID!

    balanceCoins: Float!
    lockedCoins: Float!

    createdAt: DateTime!
    updatedAt: DateTime!
  }

  #------ module -------#
  type Module {
    id: ID!
    name: String!
    slug: String!
    description: String
    section: String!
    isActive: Boolean
    createdAt: DateTime
    updatedAt: DateTime
  }

  type ModulePagination {
    data: [Module!]!
    totalCount: Int!
    currentPage: Int!
    totalPages: Int!
  }

  #*************************Role  ***********************#
  type Role {
    id: ID!
    name: String!
    slug: String!
    description: String
    isActive: Boolean
    permissions: [Permission!]
    createdAt: DateTime
    updatedAt: DateTime
  }
  type RolePagination {
    data: [Role!]!
    totalCount: Int!
    currentPage: Int!
    totalPages: Int!
  }

  #--------------Permission----------------#
  type Permission {
    id: ID!
    name: String!
    type: String!
    description: String
    modules: [Module!]
    createdAt: DateTime
    updatedAt: DateTime
  }

  type PermissionPagination {
    data: [Permission!]!
    totalCount: Int!
    currentPage: Int!
    totalPages: Int!
  }

  #------------------------------Department ____________#
  type Department {
    id: ID!
    name: String!
    slug: String!
    description: String
    isActive: Boolean
    createdAt: DateTime
    updatedAt: DateTime
  }

  type DepartmentPagination {
    data: [Department!]!
    totalCount: Int!
    currentPage: Int!
    totalPages: Int!
  }

  #------------------------------Staff ____________#
  type Staff {
    id: ID!
    name: String!
    email: String!
    department: Department
    role: Role
    permissions: [Permission!]
    isActive: Boolean
  }
  type StaffPagination {
    data: [Staff!]!
    totalCount: Int!
    currentPage: Int!
    totalPages: Int!
  }

  #-----------------moduleaccess ---#
  type ModuleAccess {
    id: ID!
    name: String!
    slug: String!
    permissions: [String!]!
  }

  type DeleteResponse {
    success: Boolean!
    message: String!
    error: String
  }

  type AddAstrologerResponse {
    success: Boolean!
    message: String!
    data: Astrologer
  }

  # --- dhwani services ___ #
  type Category {
    id: ID!
    name: String!
    slug: String!
  }

  type Service {
    id: ID!
    name: String!
    slug: String!
    type: String!

    category: Category

    image: String
    description: String
    longText: String
    price: Float
  }

  input CreateServiceInput {
    name: String!
    slug: String!
    type: String!

    categoryId: ID

    image: String
    description: String
    longText: String
    price: Float
  }

  input CreateCategoryInput {
    name: String!
  }

  #----gifts -------#
  type Gift {
    id: ID!
    name: String!
    amount: Float!
    image: String
    status: String!
  }

  input GiftInput {
    name: String!
    amount: Float!
    image: String
    status: String!
  }

  #------ Testimonial-------#
  type Testimonial {
    id: ID!
    name: String!
    address: String
    content: String!
    image: String
    rating: Int!
    createdAt: String
    updatedAt: String
  }

  input CreateTestimonialInput {
    name: String!
    address: String
    content: String!
    image: String
    rating: Int!
  }

  input UpdateTestimonialInput {
    name: String
    address: String
    content: String
    image: String
    rating: Int
  }

  #------ FAQ ------#
  type Faq {
    id: ID!
    question: String!
    answer: String!
    createdAt: String
    updatedAt: String
  }

  input CreateFaqInput {
    question: String!
    answer: String!
  }

  input UpdateFaqInput {
    question: String
    answer: String
  }

  #---------------- baneers --------#
  type Banner {
    id: ID!
    heading: String!
    subheading: String
    slug: String!
    sortorder: Int
    bannerlink: String
    language: String
    imageUrl: String
    status: Boolean
    createdAt: String
    updatedAt: String
  }

  input BannerInput {
    heading: String!
    subheading: String
    slug: String!
    sortorder: Int
    bannerlink: String
    language: String
    imageUrl: String
  }

  #-------------------- pricing --------------#
  enum PricingType {
    CHAT
    CALL
    VIDEO
    AUDIO
  }
  type AstrologerPricing {
    id: ID!
    type: PricingType!
    price: Float!
    offerPrice: Float
    commissionPercent: Float
    isActive: Boolean!
  }

  #-------------------------astrologer hirirng-------------------#
  enum InterviewStatus {
    PENDING
    SCHEDULED
    PASSED
    REJECTED
  }

  enum DocumentStatus {
    PENDING
    VERIFIED
    REJECTED
  }

  enum ApprovalStatus {
    PENDING
    APPROVED
    REJECTED
  }
  type AstrologerApplication {
    id: ID!
    name: String
    phoneNumber: String
    email: String
    gender: String
    skills: [String]
    languages: [String]
    problems: [String]

    experience: Int
    applicationStatus: String!
    interviewStatus: String
    interviewRemarks: String
    documentStatus: DocumentStatus
    approvalStatus: ApprovalStatus

    about: String
    address: String
    pincode: String

    interviewerId: String
    interviewDate: String
    interviewTime: String
    round: Int
    kycDetail: KycDetail

    createdAt: String
  }

  # pricing config #
  enum OfferType {
    FREE
    ONE_RUPEE
    ORIGINAL
  }

  type PricingConfig {
    id: ID!

    isFirstOfferEnabled: Boolean
    firstChatPrice: Int
    firstCallPrice: Int

    isSecondOfferEnabled: Boolean
    secondChatPrice: Int
    secondCallPrice: Int
  }

  type UserOfferUsage {
    userId: String!
    hasUsedFirstOffer: Boolean!
  }

  type FinalPrice {
    chatPrice: Int
    callPrice: Int
    isOfferApplied: Boolean
  }

  type OfferAnalytics {
    totalUsers: Int
    firstUsed: Int
    secondUsed: Int
  }

  type UploadResponse {
    url: String
    filename: String
  }

  #--- docs & bank details -----#
  type KycDetail {
    id: ID!

    accountHolderName: String
    accountNumber: String
    bankName: String
    ifsc: String
    branchName: String
    panNumber: String

    profileImage: String
    aadhaarImage: String
    panImage: String
    passbookImage: String

    status: DocumentStatus
  }
  input KycDetailInput {
    accountHolderName: String
    accountNumber: String
    bankName: String
    ifsc: String
    branchName: String
    panNumber: String

    profileImage: String
    aadhaarImage: String
    panImage: String
    passbookImage: String

    status: DocumentStatus
  }

  input BankDetailsInput {
    accountHolderName: String
    accountNumber: String
    bankName: String
    ifscCode: String
    panCardNumber: String
    branchName: String
    status: DocumentStatus 
  }
  input DocumentsInput {
    profilePic: String
    aadhaar: String
    panCard: String
    passbook: String
  }

  type WalletTransaction {
    id: ID!

    userWalletId: ID
    astrologerWalletId: ID

    rechargePackId: ID
    sessionId: ID
    paymentId: ID

    type: String!
    coins: Int!
    amount: Float
    description: String

    userWallet: UserWallet

    createdAt: DateTime!
  }

  type UserWallet {
    id: ID!
    userId: ID!
    coins: Int!

    user: User

    createdAt: DateTime!
    updatedAt: DateTime!
  }
  type WalletTransactionList {
    data: [WalletTransaction!]!
    totalCount: Int!
  }
  #-----------------------------END Wallet MANAGEMENT-----------------#
  #-----------------------START for astrologer walet-----------------#
  type AstrologerWallet {
    id: ID!
    astrologerId: ID!
    balanceCoins: Int
    lockedCoins: Int

    astrologer: Astrologer

    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type AstrologerWalletTransaction {
    id: ID!

    astrologerWalletId: ID

    sessionId: ID
    paymentId: ID

    type: String!
    coins: Int!
    amount: Float
    description: String

    astrologerWallet: AstrologerWallet

    createdAt: DateTime!
  }

  type AstrologerWalletTransactionList {
    data: [AstrologerWalletTransaction!]!
    totalCount: Int!
  }
  #------------------End of astrologer wallet-----------------#
  #------START FOR ALL WALLET TRANSACTIONS-----------------#

  enum WalletSource {
    USER
    ASTROLOGER
  }
  type WalletTransaction {
    id: ID!

    userWalletId: ID
    astrologerWalletId: ID

    rechargePackId: ID
    sessionId: ID
    paymentId: ID

    type: String!
    coins: Int!
    amount: Float
    description: String

    userWallet: UserWallet
    astrologerWallet: AstrologerWallet

    source: WalletSource

    createdAt: DateTime!
  }
  #---END FOR ALL WALLET TRANSACTIONS-----------------#
  #-----------------------------START of astrologer earnings-----------------#
  input AstrologerEarningSearchInput {
    query: String
    email: String
    contactNo: String

    filterType: String

    startDate: String
    endDate: String

    page: Int
    limit: Int
  }

  type AstrologerEarning {
    astrologerId: ID!
    astrologerName: String!
    email: String
    contactNo: String

    balanceCoins: Float
    totalEarned: Float
    totalWithdrawn: Float

    totalSessionEarnings: Float
    monthlyEarnings: Float
    todayEarnings: Float

    createdAt: DateTime
  }

  type AstrologerEarningList {
    data: [AstrologerEarning!]!
    totalCount: Int!
    currentPage: Int!
    totalPages: Int!
  }
  #------end of astrologer earnings-----------------#
  # -------------------- TYPES --------------------

  enum SessionFilterType {
    TODAY
    WEEK
    MONTH
    YEAR
    CUSTOM
  }

  input UserChatHistorySearchInput {
    query: String
    mobile: String
    astrologerName: String
    type: String
    status: String

    filterType: SessionFilterType

    startDate: String
    endDate: String

    page: Int
    limit: Int
  }

  type UserChatHistory {
    sessionId: ID!

    userId: ID!
    userName: String
    mobile: String

    astrologerId: ID!
    astrologerName: String

    type: String
    status: String

    ratePerMin: Float
    durationSec: Int

    coinsDeducted: Float
    coinsEarned: Float
    commission: Float

    startedAt: DateTime
    endedAt: DateTime
    createdAt: DateTime
  }

  type UserChatHistoryList {
    data: [UserChatHistory!]!

    totalCount: Int!
    currentPage: Int!
    totalPages: Int!

    totalCoinsDeducted: Float
    totalCoinsEarned: Float
    totalCommission: Float
  }
  #-------start of user chat history ---------#

  # ------------start for call-history---------------------------

  input UserCallHistorySearchInput {
    query: String
    mobile: String
    astrologerName: String
    type: String
    status: String

    filterType: SessionFilterType

    startDate: String
    endDate: String

    page: Int
    limit: Int
  }

  type UserCallHistory {
    sessionId: ID!

    userId: ID!
    userName: String
    mobile: String

    astrologerId: ID!
    astrologerName: String

    type: String
    status: String

    ratePerMin: Float
    durationSec: Int

    coinsDeducted: Float
    coinsEarned: Float
    commission: Float

    startedAt: DateTime
    endedAt: DateTime
    createdAt: DateTime
  }

  type UserCallHistoryList {
    data: [UserCallHistory!]!

    totalCount: Int!
    currentPage: Int!
    totalPages: Int!

    totalCoinsDeducted: Float
    totalCoinsEarned: Float
    totalCommission: Float
  }
  #-------start of user call history ---------#
  #--------------------END of user call history-----------------#
  #-----start of user reviews ---------#
  input UserReviewSearchInput {
    query: String
    userName: String
    astrologerName: String
    rating: Int

    filterType: SessionFilterType

    startDate: String
    endDate: String

    page: Int
    limit: Int
  }

  input UpdateAstrologerInput {
    name: String
    email: String
    contactNo: String
    dateOfBirth: String
    gender: Gender
    languages: [String!]
    skills: [String!]
    experience: Int
    about: String
  }

  input UpdateUserInput {
    name: String
    mobile: String
    gender: Gender
    birthDate: DateTime
    birthTime: String
    occupation: String
    isActive: Boolean
  }
  type UserReview {
    reviewId: ID!

    sessionId: ID

    userId: ID
    userName: String
    mobile: String

    astrologerId: ID
    astrologerName: String

    sessionType: String
    sessionStatus: String

    rating: Int

    comment: String

    createdAt: DateTime
  }

  type UserReviewList {
    data: [UserReview!]!

    totalCount: Int!
    currentPage: Int!
    totalPages: Int!

    averageRating: Float
  }
  #-------END of user reviews ---------#
  #------------START FRAUD FLAGGING ---------------#
  type FraudFlag {
    id: ID!
    keyword: String!
    createdBy: String
    createdAt: DateTime
    updatedAt: DateTime
  }

  input FraudFlagSearchInput {
    query: String
    page: Int
    limit: Int
  }

  type FraudFlagList {
    data: [FraudFlag!]!

    totalCount: Int!
    currentPage: Int!
    totalPages: Int!
  }
  #-----END FRAUD FLAGGING ---------------#
  #----------start faud LOGGING ---------------#
  enum FraudStatus {
    PENDING
    FRAUD
    FINE
  }
  type FraudLog {
    id: ID!

    orderId: String

    sessionId: String

    senderId: String
    senderName: String

    receiverId: String
    receiverName: String

    message: String

    matchedKeywords: [String]

    status: FraudStatus

    createdAt: DateTime
    updatedAt: DateTime
  }

  input FraudLogSearchInput {
    query: String
    status: FraudStatus

    filterType: SessionFilterType

    startDate: String
    endDate: String

    page: Int
    limit: Int
  }

  type FraudLogList {
    data: [FraudLog!]!

    totalCount: Int!
    currentPage: Int!
    totalPages: Int!
  }
  #------end fraud LOGGING ---------------#
  #--------------start of payment reports-----------------#
  enum PaymentOrderStatus {
    CREATED
    PAID
    FAILED
  }

  input PaymentReportSearchInput {
    query: String
    status: PaymentOrderStatus

    filterType: SessionFilterType

    startDate: String
    endDate: String

    page: Int
    limit: Int
  }
  type PaymentReport {
    id: ID!

    userId: ID!
    userName: String
    mobile: String

    rechargePackId: ID
    rechargePackName: String

    razorpayOrderId: String

    amount: Float
    coins: Int

    status: PaymentOrderStatus

    createdAt: DateTime
    updatedAt: DateTime
  }

  type PaymentReportList {
    data: [PaymentReport!]!

    totalCount: Int!
    currentPage: Int!
    totalPages: Int!

    totalAmount: Float!
    totalCoins: Int!

    paidAmount: Float!
    failedAmount: Float!

    paidCount: Int!
    failedCount: Int!
  }

  #--------------------About pagge ___________________#
  enum CmsStatus {
    DRAFT
    PUBLISHED
  }

  type AboutPage {
    id: ID

    pageType: String

    heroTitle: String
    heroDescription: String

    mentors: JSON
    founders: JSON

    metaTitle: String
    metaDescription: String

    keywords: [String]

    status: CmsStatus

    createdAt: String
    updatedAt: String
  }

  input UpdateAboutPageInput {
    heroTitle: String

    heroDescription: String

    mentors: JSON

    founders: JSON

    metaTitle: String

    metaDescription: String

    keywords: [String]

    status: CmsStatus
  }

  type PrivacyPage {
    id: ID

    pageType: String

    title: String

    content: String

    metaTitle: String

    metaDescription: String

    keywords: [String]

    status: CmsStatus

    createdAt: String
    updatedAt: String
  }

  input UpdatePrivacyPageInput {
    title: String

    content: String

    metaTitle: String

    metaDescription: String

    keywords: [String]

    status: CmsStatus
  }
  type RefundPolicyPage {
    id: ID

    pageType: String

    title: String

    content: String

    metaTitle: String

    metaDescription: String

    keywords: [String]

    status: CmsStatus

    createdAt: String
    updatedAt: String
  }

  input UpdateRefundPolicyPageInput {
    title: String

    content: String

    metaTitle: String

    metaDescription: String

    keywords: [String]

    status: CmsStatus
  }
  type DisclaimerPage {
    id: ID

    pageType: String

    title: String

    content: String

    metaTitle: String

    metaDescription: String

    keywords: [String]

    status: CmsStatus

    createdAt: String
    updatedAt: String
  }

  input UpdateDisclaimerPageInput {
    title: String

    content: String

    metaTitle: String

    metaDescription: String

    keywords: [String]

    status: CmsStatus
  }

  #-----END OF PAYMENT REPORTS-----------------#
#---------------------START code for remedy---#

type Remedy {
  id: ID!
  title: String!
  description: String
  isActive: Boolean
  createdAt: String
  updatedAt: String
}

input CreateRemedyInput {
  title: String!
  description: String
}

input UpdateRemedyInput {
  title: String
  description: String
  isActive: Boolean
}




#------------END CODE For remedy-----------------#

  type Query {
    #cmss page #
    getAboutPage: AboutPage
    getPrivacyPage: PrivacyPage
    getRefundPolicyPage: RefundPolicyPage
    getDisclaimerPage: DisclaimerPage



    #pricing config #
    getOfferAnalytics: OfferAnalytics

    getPricingConfig: PricingConfig
    getAdminPreviewPrice: FinalPrice
    getFinalPrice(astrologerId: String!): FinalPrice

    #astrologer registration #
    getApplicationById(id: String!): AstrologerApplication

    getMyInterviews: [AstrologerApplication]
    getApplication(id: ID!): AstrologerApplication
    getApplications: [AstrologerApplication!]!

    getPendingApplications: [AstrologerApplication]
    getInterviewers: [Staff]

    getBanners: [Banner]

    faqs: [Faq!]!
    faq(id: ID!): Faq

    testimonials: [Testimonial!]!
    testimonial(id: ID!): Testimonial

    getGifts: [Gift]

    getServices: [Service]
    getCategories: [Category]

    getCoupons: [Coupon]
    getSections: [String!]!
    getModulesPaginated(page: Int, limit: Int): ModulePagination!
    getModulesBySection(section: String!): [Module!]!
    getMyAccess: [ModuleAccess!]!
    getUsersListBySearch(searchInput: UserSearchInput!): UserList!

    getPendingAstrologers(page: Int, limit: Int): PaginatedAstrologers!

    getAstrologerInterviews(
      astrologerId: String!
      page: Int
      limit: Int
    ): PaginatedInterviews!

    getAstrologerListBySearch(
      searchInput: AstrologerSearchInput!
    ): AstrologerList!

    getRegisteredAstrologers(page: Int, limit: Int): [Astrologer!]!
    getApprovedAstrologers(page: Int, limit: Int): PaginatedAstrologers!

    getAdmins(page: Int = 1, limit: Int = 10): AdminPagination!

    getRoles(page: Int = 1, limit: Int = 10): RolePagination!

    getPermissions(page: Int = 1, limit: Int = 10): PermissionPagination!

    getDepartments(page: Int = 1, limit: Int = 10): DepartmentPagination!

    getStaff(page: Int = 1, limit: Int = 10): StaffPagination!

    getRechargePacks: [RechargePack!]!

    getUserWallet(userId: ID!): UserWallet

    getUserWalletTransactions(
      page: Int
      limit: Int
      type: String
      amount: Float
      mobile: String
      filterType: String
      startDate: String
      endDate: String
    ): WalletTransactionList!

    getAstrologerWalletTransactions(
      page: Int
      limit: Int
      type: String
      contactNo: String
      amount: Float
      filterType: String
      startDate: String
      endDate: String
    ): AstrologerWalletTransactionList!
    getAllWalletTransactions(
      page: Int
      limit: Int
      type: String
      amount: Float
      contactNo: String
      filterType: String
      startDate: String
      endDate: String
      source: String
    ): WalletTransactionList!

    getAstrologerEarnings(
      searchInput: AstrologerEarningSearchInput!
    ): AstrologerEarningList!

    getUsersChatHistory(
      searchInput: UserChatHistorySearchInput!
    ): UserChatHistoryList!

    getUserCallHistory(
      searchInput: UserCallHistorySearchInput!
    ): UserCallHistoryList!

    getUserReviews(searchInput: UserReviewSearchInput!): UserReviewList!
    getFraudFlags(searchInput: FraudFlagSearchInput): FraudFlagList!

    getFraudLogs(searchInput: FraudLogSearchInput): FraudLogList!

    getPaymentReports(
      searchInput: PaymentReportSearchInput!
    ): PaymentReportList!

     getRemedies: [Remedy]
  getRemedyById(id: ID!): Remedy
  
  }

  type Mutation {
    upsertAboutPage(input: UpdateAboutPageInput!): AboutPage
    upsertPrivacyPage(input: UpdatePrivacyPageInput!): PrivacyPage
    upsertRefundPolicyPage(
      input: UpdateRefundPolicyPageInput!
    ): RefundPolicyPage
    upsertDisclaimerPage(input: UpdateDisclaimerPageInput!): DisclaimerPage
    uploadImage(file: Upload!): UploadResponse

    createBanner(input: BannerInput!): Banner
    updateBanner(id: ID!, input: BannerInput!): Banner
    deleteBanner(id: ID!): Boolean

    createFaq(input: CreateFaqInput!): Faq!
    updateFaq(id: ID!, input: UpdateFaqInput!): Faq!
    deleteFaq(id: ID!): String!

    createTestimonial(input: CreateTestimonialInput!): Testimonial!
    updateTestimonial(id: ID!, input: UpdateTestimonialInput!): Testimonial!
    deleteTestimonial(id: ID!): String!

    createGift(input: GiftInput!): Gift
    deleteGift(id: ID!): Boolean
    updateGift(id: ID!, input: GiftInput!): Gift

    createService(input: CreateServiceInput!): Service
    updateService(id: ID!, input: CreateServiceInput!): Service
    deleteService(id: ID!): Boolean
    createCategory(input: CreateCategoryInput!): Category

    addAstrologer(data: AddAstrologerInput!): AddAstrologerResponse!
    loginStaff(email: String!, password: String!): AuthPayload!
    logoutAdmin: String!
    updateUser(userId: String!, data: UpdateUserInput!): User!
    deleteUser(userId: String!): Boolean!

    createPermission(
      name: String!
      moduleIds: [ID!]!
      type: String!
    ): Permission!

    updatePermission(
      permissionId: ID!
      name: String
      moduleIds: [ID!]
    ): Permission!

    deletePermission(permissionId: ID!): Boolean!

    createRole(
      name: String!
      slug: String!
      description: String
      permissionIds: [ID!]
    ): Role!

    updateRole(
      roleId: String!
      name: String
      slug: String
      description: String
      isActive: Boolean
    ): Role

    deleteRole(roleId: ID!): DeleteResponse!

    assignPermissionsToRole(roleId: ID!, permissionIds: [ID!]!): Role!

    createAdmin(
      name: String!
      email: String!
      phoneNo: String!
      password: String!
      roleId: ID!
    ): Admin!

    updateAdmin(
      adminId: String!
      name: String
      email: String
      roleId: String
    ): Admin

    deleteAdmin(adminId: String!): Boolean!

    updateAstrologer(
      astrologerId: ID!
      data: UpdateAstrologerInput!
    ): Astrologer!

    deleteAstrologer(astrologerId: ID!): Boolean!

    rejectAstrologer(
      astrologerId: ID!
      stage: String!
      reason: String!
    ): Boolean

    createRechargePack(input: RechargePackInput!): RechargePack!
    updateRechargePack(id: ID!, input: UpdateRechargePackInput!): RechargePack!
    deleteRechargePack(id: ID!): String!

    createCoupon(input: CreateCouponInput!): Coupon
    deleteCoupon(id: ID!): Boolean
    updateCouponStatus(id: ID!, status: String!): Coupon

    createModule(
      name: String!
      slug: String!
      description: String
      section: String!
    ): Module!
    updateModule(
      id: ID!
      name: String
      slug: String
      description: String
      section: String
      isActive: Boolean
    ): Module!

    deleteModule(id: ID!): Boolean!

    createDepartment(name: String!, description: String): Department!

    updateDepartment(
      departmentId: ID!
      name: String
      description: String
      isActive: Boolean
    ): Department!

    deleteDepartment(departmentId: ID!): Boolean!

    createStaff(
      name: String!
      email: String!
      password: String!
      departmentId: ID!
      roleId: ID!
      permissionIds: [ID!]!
    ): Staff!

    updateStaff(
      staffId: ID!
      name: String
      email: String
      departmentId: ID
      roleId: ID
      permissionIds: [ID!]
    ): Staff!

    deleteStaff(staffId: ID!): Boolean!

    scheduleInterview(
      astrologerId: ID!
      interviewerId: String!
      interviewDate: String!
      interviewTime: String!
      round: Int!
    ): AstrologerApplication

    updateInterviewStatus(
      astrologerId: ID!
      status: InterviewStatus!
    ): AstrologerApplication

    updateDocumentStatus(
      astrologerId: ID!
      status: DocumentStatus!
    ): AstrologerApplication

    updateApprovalStatus(
      astrologerId: ID!
      status: ApprovalStatus!
    ): AstrologerApplication

    approveAstrologer(id: ID!): Astrologer!

    updateInterviewResult(
      astrologerId: ID!
      status: String!
      remarks: String
    ): AstrologerApplication

    # pricing config mutation #
    updatePricingConfig(
      isFirstOfferEnabled: Boolean
      firstChatPrice: Int
      firstCallPrice: Int

      isSecondOfferEnabled: Boolean
      secondChatPrice: Int
      secondCallPrice: Int
    ): PricingConfig

    markOfferUsed(userId: String!): Boolean

    #---- Save bank details & docs -----#
    saveAndVerifyKyc(astrologerId: String!, input: KycDetailInput!): KycDetail
    rejectKyc(astrologerId: String!): KycDetail
    createFraudFlag(keyword: String!): FraudFlag!

    deleteFraudFlag(id: ID!): Boolean!

    updateFraudLogStatus(id: ID!, status: FraudStatus!): FraudLog!

  createRemedy(input: CreateRemedyInput!): Remedy
  updateRemedy(id: ID!, input: UpdateRemedyInput!): Remedy
  deleteRemedy(id: ID!): Boolean
  }
`;

export default typeDefs;
