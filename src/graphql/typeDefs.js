// src/graphql/typeDefs.js
import { gql } from "graphql-tag";

const typeDefs = gql`
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
    ID_PROOF
    CERTIFICATE
    EXPERIENCE_PROOF
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
  }

  input ChargesInput {
    callChatCharges: Float
    callChatOfferCharges: Float
    callChatCommission: Float
    videocall_charges: Float
    audiocall_charges: Float
    audiovideocall_offer_charges: Float
  }

  input BankDetailsInput {
    accountHolderName: String!
    accountNumber: String!
    bankName: String!
    ifscCode: String!
    panCardNumber: String!
    branchName: String!
  }

  input AddAstrologerInput {
    astroname: String!
    displayName: String!
    gender: Gender!
    email: String!
    phoneNumber: String!
    password: String!
    experience: Int!

    expertise: [String!]!
    languages: [String!]!
    problems: [String!]!

    aboutEnglish: String

    tags: String
    vtags: String

    address: AddressInput
    charges: ChargesInput
    bankDetails: BankDetailsInput
    documents: AstrologerDocumentsInput
  }
  input AstrologerDocumentsInput {
    aadhaar: String
    panCard: String
    passbook: String
    profilePic: String
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

    aboutEnglish: String

    languages: [String!]!
    skills: [String!]!
    problems: [String!]!

    callChatCharges: Float
    callChatOfferCharges: Float
    callChatCommission: Float
    videocall_charges: Float
    audiocall_charges: Float
    audiovideocall_offer_charges: Float

    tags: String
    vtags: String

    approvalStatus: ApprovalStatus!

    addresses: [Address!]!
    experiences: [ExperiencePlatform!]!
    interviews: [Interview!]!
    documents: [AstrologerDocument!]!

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

  type AstrologerDocument {
    id: ID!
    documentType: DocumentType
    documentUrl: String
    status: DocumentStatus
    remarks: String
    verifiedBy: String
    verifiedAt: String
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

  type PaginatedUsers {
    data: [User!]!
    totalCount: Int!
    currentPage: Int!
    totalPages: Int!
  }

  input UserSearchInput {
    query: String
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

  type PaginatedDocuments {
    data: [AstrologerDocument!]!
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
    isActive: Boolean
  }

  type RechargePack {
    id: ID!
    name: String!
    description: String
    price: Float!
    talktime: Int!
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
    coins: Int!
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

  #-----------------------------END Wallet MANAGEMENT-----------------#
  type Query {
   getCoupons: [Coupon]
    getSections: [String!]!
    getModulesPaginated(page: Int, limit: Int): ModulePagination!
    getModulesBySection(section: String!): [Module!]!
    getMyAccess: [ModuleAccess!]!
    getUsersDetails(page: Int, limit: Int): PaginatedUsers!
    getUsersListBySearch(searchInput: UserSearchInput!): UserList!

    getPendingAstrologers(page: Int, limit: Int): PaginatedAstrologers!

    getAstrologerInterviews(
      astrologerId: String!
      page: Int
      limit: Int
    ): PaginatedInterviews!

    getAstrologerDocuments(
      astrologerId: String!
      page: Int
      limit: Int
    ): PaginatedDocuments!

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

    getWallets: [Wallet!]!
    getUserWallet(userId: ID!): UserWallet
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

  type Mutation {
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

    addAstrologer(data: AddAstrologerInput!): Astrologer!

    updateAstrologer(
      astrologerId: ID!
      data: UpdateAstrologerInput!
    ): Astrologer!

    deleteAstrologer(astrologerId: ID!): Boolean!

    scheduleInterview(
      astrologerId: ID!
      roundNumber: Int!
      interviewerName: String!
      scheduledAt: String!
    ): Interview

    verifyDocument(
      documentId: ID!
      status: DocumentStatus!
      remarks: String
    ): AstrologerDocument

    rejectAstrologer(
      astrologerId: ID!
      stage: String!
      reason: String!
    ): Boolean

    approveAstrologer(astrologerId: ID!): Boolean
    createRechargePack(input: RechargePackInput!): RechargePack!
    updateRechargePack(id: ID!, input: UpdateRechargePackInput!): RechargePack!
    deleteRechargePack(id: ID!): String!

    createCoupon(input: CreateCouponInput!): Coupon
    deleteCoupon(id: ID!): Boolean
    updateCouponStatus(id: ID!, status: String!): Coupon

    #------------------------------START module -----------------#
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
  }
`;

export default typeDefs;
