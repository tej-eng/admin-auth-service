// src/graphql/typeDefs.js
import { gql } from "graphql-tag";

const typeDefs = gql`
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
  query: String       # search by name, skills, languages, etc.
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

  type Astrologer {
    id: ID!
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
    approvalStatus: ApprovalStatus!
    adminRemarks: String
    addresses: [Address!]!
    experiences: [ExperiencePlatform!]!
    interviews: [Interview!]!
    documents: [AstrologerDocument!]!
    rejectionHistory: [AstrologerRejectionHistory!]!
    createdAt: String
    updatedAt: String
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
    createdAt: String
  }

  type Role {
  id: ID!
  name: String!
  description: String
  permissions: [Permission!]
  createdAt: String
  updatedAt: String
}

 type Permission {
  id: ID!
  name: String!
  description: String
  createdAt: String
  updatedAt: String
}

  type Admin {
    id: ID!
    name: String!
    email: String!
    phoneNo: String!
    role: Role!
  }

  type AdminAuthPayload {
    admin: Admin!
    accessToken: String!
    refreshToken: String!
  }

  type AuthPayload {
    user: User!
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
  coins: Int!
  talktime: Int!
  validityDays: Int!
  isActive: Boolean
}

type RechargePack {
  id: ID!
  name: String!
  description: String
  price: Float!
  coins: Int!
  talktime: Int!
  validityDays: Int!
  isActive: Boolean!
  createdAt: String!
  updatedAt: String!
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
  type Query {
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
    getAstrologerListBySearch(searchInput: AstrologerSearchInput!): AstrologerList!
    getRegisteredAstrologers(page: Int, limit: Int): [Astrologer!]!
    getApprovedAstrologers(page: Int, limit: Int): PaginatedAstrologers!
    getAdmins(page: Int = 1, limit: Int = 10): AdminPagination!

    getRoles: [Role!]!
    getPermissions: [Permission!]!
    
    getRechargePacks: [RechargePack!]!

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
    loginAdmin(email: String!, password: String!): AdminAuthPayload!
    logoutAdmin: String!
    updateUser(userId: String!, data: UpdateUserInput!): User!
    deleteUser(userId: String!): String!

   
    createPermission(name: String!, description: String): Permission!

    updatePermission(
    permissionId: String!
    name: String
    description: String
  ): Permission

  deletePermission(permissionId: String!): String

    createRole(
    name: String!
    description: String
    permissionIds: [ID!]
    ): Role!
    
    updateRole(
    roleId: String!
    name: String
    description: String
    permissionIds: [String!]
  ): Role

   deleteRole(roleId: String!): String

    assignPermissionsToRole(
    roleId: ID!
    permissionIds: [ID!]!
    ): Role!

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

  deleteAdmin(adminId: String!): String

    addAstrologer(
      name: String!
      email: String!
      contactNo: String!
      gender: Gender!
      dateOfBirth: String!
      languages: [String!]!
      skills: [String!]!
      experience: Int!
      about: String!
    ): Astrologer!
   
   updateAstrologer(
    astrologerId: ID!
    data: UpdateAstrologerInput!
  ): Astrologer!

  deleteAstrologer(
    astrologerId: ID!
  ): Boolean!

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
  }
`;

export default typeDefs;
