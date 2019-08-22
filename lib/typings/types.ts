/*
 * Copyright © 2019 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export type Maybe<T> = T | null;

export interface ScmResourceProviderInput {
  orgs: string[];

  repos: ScmResourceProviderRepoInput[];
}

export interface ScmResourceProviderRepoInput {
  owner: string;

  repo: string;
}

export interface ResourceProviderStateInput {
  state: ResourceProviderStateName;

  error?: Maybe<string>;
}

export interface ScmProviderStateInput {
  state: ScmProviderStateName;

  error?: Maybe<string>;
}

export interface CredentialInput {
  type: CredentialType;

  oauth?: Maybe<OAuthInput>;

  password?: Maybe<PasswordInput>;
}

export interface OAuthInput {
  secret: string;

  scopes: string[];
}

export interface PasswordInput {
  secret: string;
}

export interface WebhookInput {
  name: string;

  resourceProviderId: string;

  authType: WebhookAuthType;

  hmacSha1?: Maybe<HmacSha1AuthInput>;

  tags?: Maybe<Array<Maybe<TagInput>>>;

  state?: Maybe<WebhookState>;
}

export interface HmacSha1AuthInput {
  /** shared secret */
  secret: string;
  /** http header in which to find the hash */
  header?: Maybe<string>;
}

export interface TagInput {
  name: string;

  value: string;
}

export interface ScmOrgsInput {
  orgs: ScmOrgInput[];
}

export interface ScmOrgInput {
  name: string;

  id?: Maybe<string>;

  url?: Maybe<string>;

  ownerType: OwnerType;
}

export interface ScmReposInput {
  /** The id of the org as represented in the Atomist graph */
  orgId: string;

  owner: string;
  /** The list of repos to ingest */
  repos: ScmRepoInput[];
}

export interface ScmRepoInput {
  /** The the id of the repo as provided by the SCM provider not the Atomist graph */
  repoId: string;
  /** The http url of the repo in the SCM provider */
  url?: Maybe<string>;
  /** The name of the repo */
  name: string;
  /** The default branch of the repo (master if unknown) */
  defaultBranch?: Maybe<string>;
}

export interface ScmCommitInput {
  /** The id of the repo as it appears in the graph */
  repoId: string;
  /** The sha of the commit */
  sha: string;
  /** The email address of the commit */
  email?: Maybe<EmailInput>;
  /** The commit message */
  message: string;
  /** The http url of the commit in the SCM provider */
  url?: Maybe<string>;
  /** The commit timestamp */
  timestamp: string;
  /** The name of the branch this commit is being ingested on */
  branchName: string;
  /** The author of the commit - optional but helpful if available */
  author?: Maybe<ScmAuthorInput>;
}

export interface EmailInput {
  address: string;
}

export interface ScmAuthorInput {
  /** The login of the commit author in the SCM provider */
  login: string;
  /** The authors email address */
  email?: Maybe<EmailInput>;
  /** The name of the author */
  name?: Maybe<string>;
}
/** For submitting new RepoFingerprints */
export interface FingerprintInput {
  /** Optional data, such as dependency version */
  data?: Maybe<string>;
  /** The unique name for this fingerprint, such as the name of a dependency */
  name: string;
  /** The hash of this fingerprint - forms ID of a SourceFingerprint */
  sha: string;
}
/** The input object for the creation of a AtmJob */
export interface AtmJobInput {
  /** Used to store additional information about this AtmJob */
  data?: Maybe<string>;
  /** A description for this job. */
  description?: Maybe<string>;

  jobTasks: AtmJobTaskInput[];
  /** Sets the name for this job */
  name: string;
  /** The owner of this job. Clients may use this in a subscription to avoid all clients subscribing to all tasks in a team. */
  owner?: Maybe<string>;
}
/** Input object for creation of AtmJobTask */
export interface AtmJobTaskInput {
  /** Sets additional information about this AtmJobTask */
  data?: Maybe<string>;
  /** Sets the name for this AtmJobTask */
  name: string;
}
/** Input object for setting the state of a AtmJobTask */
export interface AtmJobTaskStateInput {
  /** Sets additional information about the state of this AtmJobTask */
  message?: Maybe<string>;
  /** Sets the AtmJobTaskState of this AtmJobState */
  state: AtmJobTaskState;
}
/** Ordering Enum for Person */
export enum _PersonOrdering {
  atmTeamId_asc = "atmTeamId_asc",
  atmTeamId_desc = "atmTeamId_desc",
  id_asc = "id_asc",
  id_desc = "id_desc",
  forename_asc = "forename_asc",
  forename_desc = "forename_desc",
  surname_asc = "surname_asc",
  surname_desc = "surname_desc",
  name_asc = "name_asc",
  name_desc = "name_desc",
}

export enum ResourceProviderStateName {
  converged = "converged",
  unconverged = "unconverged",
  misconfigured = "misconfigured",
  unauthorized = "unauthorized",
}

export enum WebhookAuthType {
  hmac_sha1 = "hmac_sha1",
  none = "none",
}

export enum WebhookState {
  enabled = "enabled",
  disabled = "disabled",
}
/** Enum for ProviderType */
export enum ProviderType {
  bitbucket_cloud = "bitbucket_cloud",
  github_com = "github_com",
  ghe = "ghe",
  bitbucket = "bitbucket",
  gitlab = "gitlab",
}
/** Ordering Enum for Org */
export enum _OrgOrdering {
  atmTeamId_asc = "atmTeamId_asc",
  atmTeamId_desc = "atmTeamId_desc",
  id_asc = "id_asc",
  id_desc = "id_desc",
  owner_asc = "owner_asc",
  owner_desc = "owner_desc",
  ownerType_asc = "ownerType_asc",
  ownerType_desc = "ownerType_desc",
}

export enum OwnerType {
  user = "user",
  organization = "organization",
}
/** Ordering Enum for Repo */
export enum _RepoOrdering {
  atmTeamId_asc = "atmTeamId_asc",
  atmTeamId_desc = "atmTeamId_desc",
  id_asc = "id_asc",
  id_desc = "id_desc",
  owner_asc = "owner_asc",
  owner_desc = "owner_desc",
  name_asc = "name_asc",
  name_desc = "name_desc",
  allowRebaseMerge_asc = "allowRebaseMerge_asc",
  allowRebaseMerge_desc = "allowRebaseMerge_desc",
  allowSquashMerge_asc = "allowSquashMerge_asc",
  allowSquashMerge_desc = "allowSquashMerge_desc",
  allowMergeCommit_asc = "allowMergeCommit_asc",
  allowMergeCommit_desc = "allowMergeCommit_desc",
  repoId_asc = "repoId_asc",
  repoId_desc = "repoId_desc",
  gitHubId_asc = "gitHubId_asc",
  gitHubId_desc = "gitHubId_desc",
  defaultBranch_asc = "defaultBranch_asc",
  defaultBranch_desc = "defaultBranch_desc",
}
/** Ordering Enum for Label */
export enum _LabelOrdering {
  atmTeamId_asc = "atmTeamId_asc",
  atmTeamId_desc = "atmTeamId_desc",
  id_asc = "id_asc",
  id_desc = "id_desc",
  name_asc = "name_asc",
  name_desc = "name_desc",
  default_asc = "default_asc",
  default_desc = "default_desc",
  color_asc = "color_asc",
  color_desc = "color_desc",
}
/** Ordering Enum for ChatChannel */
export enum _ChatChannelOrdering {
  atmTeamId_asc = "atmTeamId_asc",
  atmTeamId_desc = "atmTeamId_desc",
  id_asc = "id_asc",
  id_desc = "id_desc",
  name_asc = "name_asc",
  name_desc = "name_desc",
  provider_asc = "provider_asc",
  provider_desc = "provider_desc",
  normalizedName_asc = "normalizedName_asc",
  normalizedName_desc = "normalizedName_desc",
  channelId_asc = "channelId_asc",
  channelId_desc = "channelId_desc",
  isDefault_asc = "isDefault_asc",
  isDefault_desc = "isDefault_desc",
  botInvitedSelf_asc = "botInvitedSelf_asc",
  botInvitedSelf_desc = "botInvitedSelf_desc",
  archived_asc = "archived_asc",
  archived_desc = "archived_desc",
}
/** Ordering Enum for Email */
export enum _EmailOrdering {
  atmTeamId_asc = "atmTeamId_asc",
  atmTeamId_desc = "atmTeamId_desc",
  address_asc = "address_asc",
  address_desc = "address_desc",
}
/** Ordering Enum for ChatId */
export enum _ChatIdOrdering {
  atmTeamId_asc = "atmTeamId_asc",
  atmTeamId_desc = "atmTeamId_desc",
  id_asc = "id_asc",
  id_desc = "id_desc",
  screenName_asc = "screenName_asc",
  screenName_desc = "screenName_desc",
  userId_asc = "userId_asc",
  userId_desc = "userId_desc",
  provider_asc = "provider_asc",
  provider_desc = "provider_desc",
  isAtomistBot_asc = "isAtomistBot_asc",
  isAtomistBot_desc = "isAtomistBot_desc",
  isOwner_asc = "isOwner_asc",
  isOwner_desc = "isOwner_desc",
  isPrimaryOwner_asc = "isPrimaryOwner_asc",
  isPrimaryOwner_desc = "isPrimaryOwner_desc",
  isAdmin_asc = "isAdmin_asc",
  isAdmin_desc = "isAdmin_desc",
  isBot_asc = "isBot_asc",
  isBot_desc = "isBot_desc",
  timezoneLabel_asc = "timezoneLabel_asc",
  timezoneLabel_desc = "timezoneLabel_desc",
}
/** Ordering Enum for ChannelLink */
export enum _ChannelLinkOrdering {
  atmTeamId_asc = "atmTeamId_asc",
  atmTeamId_desc = "atmTeamId_desc",
  id_asc = "id_asc",
  id_desc = "id_desc",
}

export enum IssueState {
  open = "open",
  closed = "closed",
  deleted = "deleted",
}
/** Ordering Enum for Issue */
export enum _IssueOrdering {
  atmTeamId_asc = "atmTeamId_asc",
  atmTeamId_desc = "atmTeamId_desc",
  id_asc = "id_asc",
  id_desc = "id_desc",
  number_asc = "number_asc",
  number_desc = "number_desc",
  name_asc = "name_asc",
  name_desc = "name_desc",
  title_asc = "title_asc",
  title_desc = "title_desc",
  body_asc = "body_asc",
  body_desc = "body_desc",
  state_asc = "state_asc",
  state_desc = "state_desc",
  timestamp_asc = "timestamp_asc",
  timestamp_desc = "timestamp_desc",
  action_asc = "action_asc",
  action_desc = "action_desc",
  createdAt_asc = "createdAt_asc",
  createdAt_desc = "createdAt_desc",
  updatedAt_asc = "updatedAt_asc",
  updatedAt_desc = "updatedAt_desc",
  closedAt_asc = "closedAt_asc",
  closedAt_desc = "closedAt_desc",
}
/** Ordering Enum for Commit */
export enum _CommitOrdering {
  atmTeamId_asc = "atmTeamId_asc",
  atmTeamId_desc = "atmTeamId_desc",
  sha_asc = "sha_asc",
  sha_desc = "sha_desc",
  message_asc = "message_asc",
  message_desc = "message_desc",
  timestamp_asc = "timestamp_asc",
  timestamp_desc = "timestamp_desc",
}
/** Enum for BuildStatus */
export enum BuildStatus {
  passed = "passed",
  broken = "broken",
  failed = "failed",
  started = "started",
  canceled = "canceled",
  pending = "pending",
  error = "error",
  queued = "queued",
}
/** Enum for BuildTrigger */
export enum BuildTrigger {
  pull_request = "pull_request",
  push = "push",
  tag = "tag",
  cron = "cron",
}
/** Ordering Enum for Build */
export enum _BuildOrdering {
  atmTeamId_asc = "atmTeamId_asc",
  atmTeamId_desc = "atmTeamId_desc",
  id_asc = "id_asc",
  id_desc = "id_desc",
  buildId_asc = "buildId_asc",
  buildId_desc = "buildId_desc",
  number_asc = "number_asc",
  number_desc = "number_desc",
  name_asc = "name_asc",
  name_desc = "name_desc",
  status_asc = "status_asc",
  status_desc = "status_desc",
  buildUrl_asc = "buildUrl_asc",
  buildUrl_desc = "buildUrl_desc",
  compareUrl_asc = "compareUrl_asc",
  compareUrl_desc = "compareUrl_desc",
  trigger_asc = "trigger_asc",
  trigger_desc = "trigger_desc",
  provider_asc = "provider_asc",
  provider_desc = "provider_desc",
  pullRequestNumber_asc = "pullRequestNumber_asc",
  pullRequestNumber_desc = "pullRequestNumber_desc",
  startedAt_asc = "startedAt_asc",
  startedAt_desc = "startedAt_desc",
  finishedAt_asc = "finishedAt_asc",
  finishedAt_desc = "finishedAt_desc",
  timestamp_asc = "timestamp_asc",
  timestamp_desc = "timestamp_desc",
  workflowId_asc = "workflowId_asc",
  workflowId_desc = "workflowId_desc",
  jobName_asc = "jobName_asc",
  jobName_desc = "jobName_desc",
  jobId_asc = "jobId_asc",
  jobId_desc = "jobId_desc",
  data_asc = "data_asc",
  data_desc = "data_desc",
}
/** Enum for PipelineStatus */
export enum PipelineStatus {
  running = "running",
  pending = "pending",
  success = "success",
  failed = "failed",
  canceled = "canceled",
  skipped = "skipped",
  manual = "manual",
}
/** Enum for the PipelineProviders */
export enum PipelineProvider {
  gitlab_ci = "gitlab_ci",
}
/** Enum for JobStatus */
export enum JobStatus {
  created = "created",
  pending = "pending",
  running = "running",
  failed = "failed",
  success = "success",
  canceled = "canceled",
  skipped = "skipped",
  manual = "manual",
}

export enum SdmGoalState {
  success = "success",
  pre_approved = "pre_approved",
  requested = "requested",
  waiting_for_pre_approval = "waiting_for_pre_approval",
  approved = "approved",
  waiting_for_approval = "waiting_for_approval",
  failure = "failure",
  stopped = "stopped",
  planned = "planned",
  in_process = "in_process",
  skipped = "skipped",
  canceled = "canceled",
}

export enum SdmGoalDisplayFormat {
  compact = "compact",
  full = "full",
}

export enum SdmGoalDisplayState {
  show_current = "show_current",
  show_all = "show_all",
}
/** Enum for MergeStatus */
export enum MergeStatus {
  can_be_merged = "can_be_merged",
  unchecked = "unchecked",
  cannot_be_merged = "cannot_be_merged",
}

export enum PullRequestAction {
  assigned = "assigned",
  created = "created",
  unassigned = "unassigned",
  review_requested = "review_requested",
  review_request_removed = "review_request_removed",
  labeled = "labeled",
  unlabeled = "unlabeled",
  opened = "opened",
  edited = "edited",
  closed = "closed",
  reopened = "reopened",
  synchronize = "synchronize",
  submitted = "submitted",
  ready_for_review = "ready_for_review",
}
/** Ordering Enum for SCMId */
export enum _ScmIdOrdering {
  atmTeamId_asc = "atmTeamId_asc",
  atmTeamId_desc = "atmTeamId_desc",
  login_asc = "login_asc",
  login_desc = "login_desc",
  name_asc = "name_asc",
  name_desc = "name_desc",
  avatar_asc = "avatar_asc",
  avatar_desc = "avatar_desc",
}
/** Ordering Enum for PullRequest */
export enum _PullRequestOrdering {
  atmTeamId_asc = "atmTeamId_asc",
  atmTeamId_desc = "atmTeamId_desc",
  id_asc = "id_asc",
  id_desc = "id_desc",
  number_asc = "number_asc",
  number_desc = "number_desc",
  prId_asc = "prId_asc",
  prId_desc = "prId_desc",
  name_asc = "name_asc",
  name_desc = "name_desc",
  body_asc = "body_asc",
  body_desc = "body_desc",
  state_asc = "state_asc",
  state_desc = "state_desc",
  merged_asc = "merged_asc",
  merged_desc = "merged_desc",
  timestamp_asc = "timestamp_asc",
  timestamp_desc = "timestamp_desc",
  baseBranchName_asc = "baseBranchName_asc",
  baseBranchName_desc = "baseBranchName_desc",
  branchName_asc = "branchName_asc",
  branchName_desc = "branchName_desc",
  title_asc = "title_asc",
  title_desc = "title_desc",
  createdAt_asc = "createdAt_asc",
  createdAt_desc = "createdAt_desc",
  updatedAt_asc = "updatedAt_asc",
  updatedAt_desc = "updatedAt_desc",
  closedAt_asc = "closedAt_asc",
  closedAt_desc = "closedAt_desc",
  mergedAt_asc = "mergedAt_asc",
  mergedAt_desc = "mergedAt_desc",
  mergeStatus_asc = "mergeStatus_asc",
  mergeStatus_desc = "mergeStatus_desc",
}
/** Enum for ReviewState */
export enum ReviewState {
  requested = "requested",
  pending = "pending",
  approved = "approved",
  commented = "commented",
  unapproved = "unapproved",
  changes_requested = "changes_requested",
}
/** Ordering Enum for Review */
export enum _ReviewOrdering {
  atmTeamId_asc = "atmTeamId_asc",
  atmTeamId_desc = "atmTeamId_desc",
  id_asc = "id_asc",
  id_desc = "id_desc",
  gitHubId_asc = "gitHubId_asc",
  gitHubId_desc = "gitHubId_desc",
  reviewId_asc = "reviewId_asc",
  reviewId_desc = "reviewId_desc",
  body_asc = "body_asc",
  body_desc = "body_desc",
  state_asc = "state_asc",
  state_desc = "state_desc",
  submittedAt_asc = "submittedAt_asc",
  submittedAt_desc = "submittedAt_desc",
  htmlUrl_asc = "htmlUrl_asc",
  htmlUrl_desc = "htmlUrl_desc",
}
/** Ordering Enum for Comment */
export enum _CommentOrdering {
  atmTeamId_asc = "atmTeamId_asc",
  atmTeamId_desc = "atmTeamId_desc",
  id_asc = "id_asc",
  id_desc = "id_desc",
  body_asc = "body_asc",
  body_desc = "body_desc",
  timestamp_asc = "timestamp_asc",
  timestamp_desc = "timestamp_desc",
  createdAt_asc = "createdAt_asc",
  createdAt_desc = "createdAt_desc",
  updatedAt_asc = "updatedAt_asc",
  updatedAt_desc = "updatedAt_desc",
  commentId_asc = "commentId_asc",
  commentId_desc = "commentId_desc",
  gitHubId_asc = "gitHubId_asc",
  gitHubId_desc = "gitHubId_desc",
  path_asc = "path_asc",
  path_desc = "path_desc",
  position_asc = "position_asc",
  position_desc = "position_desc",
  htmlUrl_asc = "htmlUrl_asc",
  htmlUrl_desc = "htmlUrl_desc",
  commentType_asc = "commentType_asc",
  commentType_desc = "commentType_desc",
}
/** Enum for CommentCommentType */
export enum CommentCommentType {
  review = "review",
  pullRequest = "pullRequest",
  issue = "issue",
}
/** Ordering Enum for DockerImage */
export enum _DockerImageOrdering {
  atmTeamId_asc = "atmTeamId_asc",
  atmTeamId_desc = "atmTeamId_desc",
  image_asc = "image_asc",
  image_desc = "image_desc",
  imageName_asc = "imageName_asc",
  imageName_desc = "imageName_desc",
  timestamp_asc = "timestamp_asc",
  timestamp_desc = "timestamp_desc",
}
/** Ordering Enum for K8Pod */
export enum _K8PodOrdering {
  atmTeamId_asc = "atmTeamId_asc",
  atmTeamId_desc = "atmTeamId_desc",
  name_asc = "name_asc",
  name_desc = "name_desc",
  phase_asc = "phase_asc",
  phase_desc = "phase_desc",
  environment_asc = "environment_asc",
  environment_desc = "environment_desc",
  timestamp_asc = "timestamp_asc",
  timestamp_desc = "timestamp_desc",
  baseName_asc = "baseName_asc",
  baseName_desc = "baseName_desc",
  namespace_asc = "namespace_asc",
  namespace_desc = "namespace_desc",
  statusJSON_asc = "statusJSON_asc",
  statusJSON_desc = "statusJSON_desc",
  host_asc = "host_asc",
  host_desc = "host_desc",
  state_asc = "state_asc",
  state_desc = "state_desc",
  specsJSON_asc = "specsJSON_asc",
  specsJSON_desc = "specsJSON_desc",
  envJSON_asc = "envJSON_asc",
  envJSON_desc = "envJSON_desc",
  metadataJSON_asc = "metadataJSON_asc",
  metadataJSON_desc = "metadataJSON_desc",
  containersCrashLoopBackOff_asc = "containersCrashLoopBackOff_asc",
  containersCrashLoopBackOff_desc = "containersCrashLoopBackOff_desc",
  resourceVersion_asc = "resourceVersion_asc",
  resourceVersion_desc = "resourceVersion_desc",
}
/** Ordering Enum for K8Container */
export enum _K8ContainerOrdering {
  atmTeamId_asc = "atmTeamId_asc",
  atmTeamId_desc = "atmTeamId_desc",
  name_asc = "name_asc",
  name_desc = "name_desc",
  imageName_asc = "imageName_asc",
  imageName_desc = "imageName_desc",
  timestamp_asc = "timestamp_asc",
  timestamp_desc = "timestamp_desc",
  environment_asc = "environment_asc",
  environment_desc = "environment_desc",
  containerJSON_asc = "containerJSON_asc",
  containerJSON_desc = "containerJSON_desc",
  state_asc = "state_asc",
  state_desc = "state_desc",
  stateReason_asc = "stateReason_asc",
  stateReason_desc = "stateReason_desc",
  ready_asc = "ready_asc",
  ready_desc = "ready_desc",
  restartCount_asc = "restartCount_asc",
  restartCount_desc = "restartCount_desc",
  statusJSON_asc = "statusJSON_asc",
  statusJSON_desc = "statusJSON_desc",
  resourceVersion_asc = "resourceVersion_asc",
  resourceVersion_desc = "resourceVersion_desc",
  containerID_asc = "containerID_asc",
  containerID_desc = "containerID_desc",
}
/** Ordering Enum for Tag */
export enum _TagOrdering {
  atmTeamId_asc = "atmTeamId_asc",
  atmTeamId_desc = "atmTeamId_desc",
  id_asc = "id_asc",
  id_desc = "id_desc",
  name_asc = "name_asc",
  name_desc = "name_desc",
  description_asc = "description_asc",
  description_desc = "description_desc",
  ref_asc = "ref_asc",
  ref_desc = "ref_desc",
  timestamp_asc = "timestamp_asc",
  timestamp_desc = "timestamp_desc",
}
/** Enum for StatusState */
export enum StatusState {
  pending = "pending",
  success = "success",
  error = "error",
  failure = "failure",
}
/** Ordering Enum for Status */
export enum _StatusOrdering {
  atmTeamId_asc = "atmTeamId_asc",
  atmTeamId_desc = "atmTeamId_desc",
  id_asc = "id_asc",
  id_desc = "id_desc",
  state_asc = "state_asc",
  state_desc = "state_desc",
  description_asc = "description_asc",
  description_desc = "description_desc",
  targetUrl_asc = "targetUrl_asc",
  targetUrl_desc = "targetUrl_desc",
  context_asc = "context_asc",
  context_desc = "context_desc",
  timestamp_asc = "timestamp_asc",
  timestamp_desc = "timestamp_desc",
}
/** Ordering Enum for Push */
export enum _PushOrdering {
  atmTeamId_asc = "atmTeamId_asc",
  atmTeamId_desc = "atmTeamId_desc",
  id_asc = "id_asc",
  id_desc = "id_desc",
  timestamp_asc = "timestamp_asc",
  timestamp_desc = "timestamp_desc",
  branch_asc = "branch_asc",
  branch_desc = "branch_desc",
}
/** Ordering Enum for HerokuApp */
export enum _HerokuAppOrdering {
  atmTeamId_asc = "atmTeamId_asc",
  atmTeamId_desc = "atmTeamId_desc",
  app_asc = "app_asc",
  app_desc = "app_desc",
  url_asc = "url_asc",
  url_desc = "url_desc",
  timestamp_asc = "timestamp_asc",
  timestamp_desc = "timestamp_desc",
  user_asc = "user_asc",
  user_desc = "user_desc",
  appId_asc = "appId_asc",
  appId_desc = "appId_desc",
  release_asc = "release_asc",
  release_desc = "release_desc",
}
/** Ordering Enum for Application */
export enum _ApplicationOrdering {
  atmTeamId_asc = "atmTeamId_asc",
  atmTeamId_desc = "atmTeamId_desc",
  id_asc = "id_asc",
  id_desc = "id_desc",
  state_asc = "state_asc",
  state_desc = "state_desc",
  host_asc = "host_asc",
  host_desc = "host_desc",
  timestamp_asc = "timestamp_asc",
  timestamp_desc = "timestamp_desc",
  domain_asc = "domain_asc",
  domain_desc = "domain_desc",
  data_asc = "data_asc",
  data_desc = "data_desc",
}
/** Ordering Enum for Fingerprint */
export enum _FingerprintOrdering {
  atmTeamId_asc = "atmTeamId_asc",
  atmTeamId_desc = "atmTeamId_desc",
  name_asc = "name_asc",
  name_desc = "name_desc",
  sha_asc = "sha_asc",
  sha_desc = "sha_desc",
  data_asc = "data_asc",
  data_desc = "data_desc",
}
/** Ordering Enum for Branch */
export enum _BranchOrdering {
  atmTeamId_asc = "atmTeamId_asc",
  atmTeamId_desc = "atmTeamId_desc",
  id_asc = "id_asc",
  id_desc = "id_desc",
  name_asc = "name_asc",
  name_desc = "name_desc",
  timestamp_asc = "timestamp_asc",
  timestamp_desc = "timestamp_desc",
  isRemote_asc = "isRemote_asc",
  isRemote_desc = "isRemote_desc",
  remoteRepoHtmlUrl_asc = "remoteRepoHtmlUrl_asc",
  remoteRepoHtmlUrl_desc = "remoteRepoHtmlUrl_desc",
}
/** Ordering Enum for SCMProvider */
export enum _ScmProviderOrdering {
  atmTeamId_asc = "atmTeamId_asc",
  atmTeamId_desc = "atmTeamId_desc",
  id_asc = "id_asc",
  id_desc = "id_desc",
  url_asc = "url_asc",
  url_desc = "url_desc",
  providerId_asc = "providerId_asc",
  providerId_desc = "providerId_desc",
  apiUrl_asc = "apiUrl_asc",
  apiUrl_desc = "apiUrl_desc",
  gitUrl_asc = "gitUrl_asc",
  gitUrl_desc = "gitUrl_desc",
  providerType_asc = "providerType_asc",
  providerType_desc = "providerType_desc",
}
/** Ordering Enum for ChatTeam */
export enum _ChatTeamOrdering {
  atmTeamId_asc = "atmTeamId_asc",
  atmTeamId_desc = "atmTeamId_desc",
  id_asc = "id_asc",
  id_desc = "id_desc",
  name_asc = "name_asc",
  name_desc = "name_desc",
  provider_asc = "provider_asc",
  provider_desc = "provider_desc",
  domain_asc = "domain_asc",
  domain_desc = "domain_desc",
  messageCount_asc = "messageCount_asc",
  messageCount_desc = "messageCount_desc",
  emailDomain_asc = "emailDomain_asc",
  emailDomain_desc = "emailDomain_desc",
}
/** Ordering Enum for Workflow */
export enum _WorkflowOrdering {
  atmTeamId_asc = "atmTeamId_asc",
  atmTeamId_desc = "atmTeamId_desc",
  id_asc = "id_asc",
  id_desc = "id_desc",
  name_asc = "name_asc",
  name_desc = "name_desc",
  workflowId_asc = "workflowId_asc",
  workflowId_desc = "workflowId_desc",
  provider_asc = "provider_asc",
  provider_desc = "provider_desc",
  config_asc = "config_asc",
  config_desc = "config_desc",
}
/** Ordering Enum for DeletedBranch */
export enum _DeletedBranchOrdering {
  atmTeamId_asc = "atmTeamId_asc",
  atmTeamId_desc = "atmTeamId_desc",
  id_asc = "id_asc",
  id_desc = "id_desc",
  name_asc = "name_asc",
  name_desc = "name_desc",
  timestamp_asc = "timestamp_asc",
  timestamp_desc = "timestamp_desc",
}

export enum _GitHubAppInstallationOrdering {
  owner_asc = "owner_asc",
  owner_desc = "owner_desc",
  ownerType_asc = "ownerType_asc",
  ownerType_desc = "ownerType_desc",
}
/** Ordering Enum for SCMId */
export enum _GitHubAppResourceUserOrdering {
  login_asc = "login_asc",
  login_desc = "login_desc",
}
/** Ordering Enum for GitHubId */
export enum _GitHubIdOrdering {
  atmTeamId_asc = "atmTeamId_asc",
  atmTeamId_desc = "atmTeamId_desc",
  login_asc = "login_asc",
  login_desc = "login_desc",
  name_asc = "name_asc",
  name_desc = "name_desc",
}
/** Ordering Enum for ImageLinked */
export enum _ImageLinkedOrdering {
  atmTeamId_asc = "atmTeamId_asc",
  atmTeamId_desc = "atmTeamId_desc",
  timestamp_asc = "timestamp_asc",
  timestamp_desc = "timestamp_desc",
}
/** Ordering Enum for Release */
export enum _ReleaseOrdering {
  atmTeamId_asc = "atmTeamId_asc",
  atmTeamId_desc = "atmTeamId_desc",
  id_asc = "id_asc",
  id_desc = "id_desc",
  name_asc = "name_asc",
  name_desc = "name_desc",
  timestamp_asc = "timestamp_asc",
  timestamp_desc = "timestamp_desc",
}
/** Ordering Enum for Team */
export enum _TeamOrdering {
  atmTeamId_asc = "atmTeamId_asc",
  atmTeamId_desc = "atmTeamId_desc",
  id_asc = "id_asc",
  id_desc = "id_desc",
  name_asc = "name_asc",
  name_desc = "name_desc",
  description_asc = "description_asc",
  description_desc = "description_desc",
  iconUrl_asc = "iconUrl_asc",
  iconUrl_desc = "iconUrl_desc",
  createdAt_asc = "createdAt_asc",
  createdAt_desc = "createdAt_desc",
}
/** Ordering Enum for PushImpact */
export enum _PushImpactOrdering {
  atmTeamId_asc = "atmTeamId_asc",
  atmTeamId_desc = "atmTeamId_desc",
  id_asc = "id_asc",
  id_desc = "id_desc",
  url_asc = "url_asc",
  url_desc = "url_desc",
  data_asc = "data_asc",
  data_desc = "data_desc",
}
/** Ordering Enum for PullRequestImpact */
export enum _PullRequestImpactOrdering {
  atmTeamId_asc = "atmTeamId_asc",
  atmTeamId_desc = "atmTeamId_desc",
  id_asc = "id_asc",
  id_desc = "id_desc",
  url_asc = "url_asc",
  url_desc = "url_desc",
  data_asc = "data_asc",
  data_desc = "data_desc",
}
/** Ordering Enum for ResourceProvider */
export enum _ResourceProviderOrdering {
  atmTeamId_asc = "atmTeamId_asc",
  atmTeamId_desc = "atmTeamId_desc",
  id_asc = "id_asc",
  id_desc = "id_desc",
}
/** Ordering Enum for GitHubProvider */
export enum _GitHubProviderOrdering {
  atmTeamId_asc = "atmTeamId_asc",
  atmTeamId_desc = "atmTeamId_desc",
  id_asc = "id_asc",
  id_desc = "id_desc",
  url_asc = "url_asc",
  url_desc = "url_desc",
  providerId_asc = "providerId_asc",
  providerId_desc = "providerId_desc",
  apiUrl_asc = "apiUrl_asc",
  apiUrl_desc = "apiUrl_desc",
  gitUrl_asc = "gitUrl_asc",
  gitUrl_desc = "gitUrl_desc",
  providerType_asc = "providerType_asc",
  providerType_desc = "providerType_desc",
}

export enum DockerRegistryType {
  JFrog = "JFrog",
  DockerHub = "DockerHub",
}

export enum BinaryRepositoryType {
  maven2 = "maven2",
  npm = "npm",
}
/** Ordering Enum for UserJoinedChannel */
export enum _UserJoinedChannelOrdering {
  atmTeamId_asc = "atmTeamId_asc",
  atmTeamId_desc = "atmTeamId_desc",
  id_asc = "id_asc",
  id_desc = "id_desc",
}
/** The state of an AtmJob */
export enum AtmJobState {
  running = "running",
  completed = "completed",
}
/** The state of a AtmJobTask */
export enum AtmJobTaskState {
  created = "created",
  failed = "failed",
  success = "success",
}
/** asc or desc ordering. Must be used with orderBy */
export enum _Ordering {
  desc = "desc",
  asc = "asc",
}

export enum CommitIssueRelationshipType {
  references = "references",
  fixes = "fixes",
}

export enum SdmDeployState {
  requested = "requested",
  disabled = "disabled",
}

export enum ScmProviderStateName {
  converged = "converged",
  unconverged = "unconverged",
  misconfigured = "misconfigured",
  unauthorized = "unauthorized",
}

export enum CredentialType {
  OAuthToken = "OAuthToken",
  Password = "Password",
}

export enum ResourceUserType {
  SCMId = "SCMId",
  GenericResourceUser = "GenericResourceUser",
  SystemAccount = "SystemAccount",
  GitHubAppResourceUser = "GitHubAppResourceUser",
}

// ====================================================
// Documents
// ====================================================

export namespace IngestScmCommit {
  export interface Variables {
    providerId: string;
    commit: ScmCommitInput;
  }

  export interface Mutation {
    __typename?: "Mutation";

    ingestSCMCommit?: IngestScmCommit;
  }

  export interface IngestScmCommit {
    __typename?: "Commit";

    id?: Maybe<string>;
  }
}

export namespace GetFpTargets {
  export interface Variables {}

  export interface Query {
    __typename?: "Query";

    TeamConfiguration?: Maybe<Array<Maybe<TeamConfiguration>>>;
  }

  export interface TeamConfiguration {
    __typename?: "TeamConfiguration";

    name?: string;

    value?: string;

    namespace?: string;
  }
}

export namespace GitHubAppInstallationByOwner {
  export interface Variables {
    name: string;
  }

  export interface Query {
    __typename?: "Query";

    GitHubAppInstallation?: Maybe<Array<Maybe<GitHubAppInstallation>>>;
  }

  export interface GitHubAppInstallation {
    __typename?: "GitHubAppInstallation";

    token?: Maybe<Token>;
  }

  export interface Token {
    __typename?: "GitHubAppInstallationToken";

    secret?: string;
  }
}

export namespace ReposByProvider {
  export interface Variables {
    providerId?: Maybe<string>;
    org?: Maybe<string>;
  }

  export interface Query {
    __typename?: "Query";

    Org?: Maybe<Array<Maybe<Org>>>;
  }

  export interface Org {
    __typename?: "Org";

    owner?: Maybe<string>;

    repos?: Maybe<Array<Maybe<Repos>>>;

    scmProvider?: Maybe<ScmProvider>;
  }

  export interface Repos {
    __typename?: "Repo";

    id?: Maybe<string>;

    owner?: Maybe<string>;

    name?: Maybe<string>;

    defaultBranch?: Maybe<string>;
  }

  export interface ScmProvider {
    __typename?: "SCMProvider";

    id?: string;

    providerId?: Maybe<string>;
  }
}

export namespace ScmProviderById {
  export interface Variables {
    providerId: string;
  }

  export interface Query {
    __typename?: "Query";

    SCMProvider?: Maybe<Array<Maybe<ScmProvider>>>;
  }

  export interface ScmProvider {
    __typename?: "SCMProvider";

    apiUrl?: Maybe<string>;

    providerType?: Maybe<ProviderType>;

    id?: string;

    providerId?: Maybe<string>;

    credential?: Maybe<Credential>;
  }

  export interface Credential {
    __typename?: "OAuthToken";

    scopes?: string[];

    secret?: string;
  }
}

export namespace OnDiscoveryJob {
  export interface Variables {}

  export interface Subscription {
    __typename?: "Subscription";

    AtmJob?: Maybe<AtmJob[]>;
  }

  export interface AtmJob {
    __typename?: "AtmJob";

    name?: string;

    data?: Maybe<string>;

    state?: AtmJobState;
  }
}

export namespace OnGitHubAppInstallation {
  export interface Variables {}

  export interface Subscription {
    __typename?: "Subscription";

    GitHubAppInstallation?: Maybe<Array<Maybe<GitHubAppInstallation>>>;
  }

  export interface GitHubAppInstallation {
    __typename?: "GitHubAppInstallation";

    id?: string;

    owner?: string;

    ownerType?: OwnerType;

    gitHubAppResourceProvider?: GitHubAppResourceProvider;
  }

  export interface GitHubAppResourceProvider {
    __typename?: "GitHubAppResourceProvider";

    id?: string;

    providerId?: string;

    apiUrl?: string;

    credential?: Maybe<Credential>;
  }

  export interface Credential {
    __typename?: "OAuthToken";

    owner?: Owner;
  }

  export interface Owner {
    __typename?: "SCMId";

    login?: string;
  }
}

export namespace OnPullRequest {
  export interface Variables {}

  export interface Subscription {
    __typename?: "Subscription";

    PullRequest?: Maybe<Array<Maybe<PullRequest>>>;
  }

  export interface PullRequest {
    __typename?: "PullRequest";

    id?: Maybe<string>;

    body?: Maybe<string>;

    state?: Maybe<string>;

    action?: Maybe<PullRequestAction>;

    head?: Maybe<Head>;

    branchName?: Maybe<string>;
  }

  export interface Head {
    __typename?: "Commit";

    sha?: Maybe<string>;

    message?: Maybe<string>;
  }
}
