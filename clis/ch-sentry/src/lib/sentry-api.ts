/**
 * Sentry API Client
 *
 * This file serves as the core integration point for all commands to interact with
 * the Sentry API as documented at https://docs.sentry.io/api/.
 */

// Types
export type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export interface SentryApiConfig {
  authToken: string;
  organization: string;
  region?: 'us' | 'eu' | null;
  baseUrl?: string;
  fetch?: FetchLike;
}

/**
 * Error response from the Sentry API
 */
export interface SentryApiErrorResponse {
  status?: number;
  message?: string;
  detail?: string;
  code?: string;
  errors?: Record<string, string[]>;
}

/**
 * Tag information for a Sentry project
 */
export interface SentryTag {
  key: string;
  name?: string;
  uniqueValues: number;
}

/**
 * Tag value information for a specific tag
 */
export interface SentryTagValue {
  name: string;
  count?: number;
  firstSeen?: string;
  lastSeen?: string;
}

/**
 * Event data from the Sentry API
 */
export interface SentryEvent {
  id: string;
  eventID: string;
  groupID: string;
  title: string;
  message: string;
  dateCreated: string;
  dateReceived: string;
  platform?: string;
  // Updated tags structure to match API response
  tags: {
    key: string;
    value: string;
  }[];
  entries: unknown[];
  metadata: Record<string, unknown>;
  contexts: Record<string, unknown>;
  user?: {
    id?: string;
    username?: string;
    email?: string;
    ipAddress?: string;
  };
  sdk?: {
    name: string;
    version: string;
  };
  type: string;
  size: number;
  // Added missing fields from official API
  dist?: string;
  userReport?: Record<string, unknown> | null;
  previousEventID?: string | null;
  nextEventID?: string | null;
}

/**
 * Error class for Sentry API errors
 */
export class SentryApiError extends Error {
  /**
   * HTTP status code of the error
   */
  public status?: number;

  /**
   * Create a new Sentry API error
   */
  constructor(message: string, statusOrError?: number | Error) {
    super(message, {
      cause: statusOrError instanceof Error ? statusOrError : undefined,
    });
    this.name = 'SentryApiError';

    // If status is provided directly as a number, use it
    if (typeof statusOrError === 'number') {
      this.status = statusOrError;
    }
    // Otherwise try to extract from error object
    else if (statusOrError instanceof Error) {
      // Try to extract status from a property directly on the error
      if (
        'status' in statusOrError &&
        typeof statusOrError.status === 'number'
      ) {
        this.status = statusOrError.status;
      } else if (
        // Try to extract from the response property if it exists
        'response' in statusOrError &&
        typeof statusOrError.response === 'object' &&
        statusOrError.response
      ) {
        if ('status' in statusOrError.response) {
          this.status = Number(statusOrError.response.status);
        }
      }
    }
  }
}

/**
 * Team information in Sentry
 */
export interface SentryTeam {
  id: string;
  slug: string;
  name: string;
}

export interface SentryProject {
  id: string;
  slug: string;
  name: string;
  isBookmarked: boolean;
  dateCreated: string;
  firstEvent?: string | null;
  platform?: string | null;
  organization: {
    id: string;
    slug: string;
    name: string;
  };
  // Support for both the singular team field and teams array
  team?: SentryTeam;
  teams: SentryTeam[];
  features: string[];
  status: string;
  stats?: Record<string, number>;
  // Additional fields from the Sentry API
  isMember?: boolean;
  hasAccess?: boolean;
  isPublic?: boolean;
  isInternal?: boolean;
  latestRelease?: {
    version: string;
    dateCreated?: string;
    dateReleased?: string | null;
    deployCount?: number;
    newGroups?: number;
    commitCount?: number;
    url?: string;
  } | null;
  color?: string;
  avatar?: {
    avatarType?: string;
    avatarUuid?: string | null;
  };
  digestsMinDelay?: number;
  digestsMaxDelay?: number;
  subjectPrefix?: string;
  subjectTemplate?: string;
  securityToken?: string;
  securityTokenHeader?: string;
}

export interface SentryIssue {
  id: string;
  shortId: string;
  title: string;
  culprit: string;
  status: string;
  level: string;
  project: {
    id: string;
    slug: string;
    name: string;
  };
  type: string;
  metadata: Record<string, unknown>;
  numComments: number;
  assignedTo: unknown | null;
  isPublic: boolean;
  hasSeen: boolean;
  isSubscribed: boolean;
  isBookmarked: boolean;
  count: string;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  stats: Record<string, [number, number][]>;
  /**
   * Optional annotations attached to an issue (e.g., integrations like Linear).
   * When present, items typically include a human-friendly display name and a URL.
   */
  annotations?: {
    displayName?: string;
    url?: string;
    // Preserve any additional fields returned by Sentry without typing them strictly
    [key: string]: unknown;
  }[];
  // Added missing fields from official API
  activity?: unknown[];
  userReportCount?: number;
  participants?: {
    id: string;
    email: string;
    username?: string;
    name?: string;
    avatarUrl?: string;
  }[];
  firstRelease?: {
    version: string;
    dateCreated?: string;
    dateReleased?: string | null;
  } | null;
}

export interface SentryRelease {
  id: string;
  version: string;
  dateCreated: string;
  dateReleased?: string | null;
  commits?: {
    id: string;
    repository: string;
    message: string;
    author: {
      name: string;
      email: string;
    };
    dateAdded: string;
  }[];
  lastDeploy?: {
    id: string;
    environment: string;
    name: string;
    dateStarted: string;
    dateFinished: string;
  } | null;
  deployCount: number;
  newGroups: number;
  projects: {
    id: string;
    slug: string;
    name: string;
  }[];
  url: string;
}

/** Options for getReleases() */
export interface GetReleasesOptions {
  /** Maximum number of releases to return; mapped to `per_page`. */
  limit?: number;
  /** Optional project slug to filter releases when supported by the API. */
  project?: string;
}

interface RequestOptions extends RequestInit {
  searchParams?: Record<string, string | number>;
  jsonBody?: unknown;
}

/**
 * Main Sentry API client class
 */
export class SentryApiClient {
  private authToken: string;
  private organization: string;
  private baseUrl: string;
  private readonly fetch: FetchLike;

  /**
   * Create a new Sentry API client
   *
   * @param config Explicit client configuration
   * @throws SentryApiError if required configuration is missing
   */
  constructor(config: SentryApiConfig) {
    this.authToken = config.authToken;
    this.organization = config.organization;
    this.baseUrl = config.baseUrl ?? 'https://sentry.io/api/0';
    this.fetch = config.fetch ?? fetch;

    // Validate required configuration
    this.validateConfig();
  }

  /**
   * Validate that required configuration fields are present
   */
  private validateConfig(): void {
    if (!this.authToken) {
      throw new SentryApiError(
        'Missing SENTRY_AUTH_TOKEN environment variable. Generate a token at https://sentry.io/settings/account/api/auth-tokens/'
      );
    }

    if (!this.organization) {
      throw new SentryApiError(
        'Missing SENTRY_ORG environment variable. Set it to your Sentry organization slug.'
      );
    }
  }

  /**
   * Make a request to the Sentry API
   */
  private async request<T>(
    path: string,
    options: RequestOptions = {}
  ): Promise<T> {
    // Define retryable status codes (timeouts, rate limits, server errors)
    const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
    const maxRetries = 3;

    let lastError: Error | null = null;
    let lastStatus: number | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // If this is a retry, wait with exponential backoff
        if (attempt > 0) {
          const delay = Math.pow(2, attempt) * 100; // 200ms, 400ms, 800ms
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        // Ensure path doesn't start with a slash for URL appending
        const normalizedPath = path.startsWith('/') ? path.substring(1) : path;

        // Construct a proper URL string with path correctly appended to base URL
        // NOTE: This approach ensures paths are correctly joined regardless of
        // whether the base URL ends with a slash or not
        let urlString = this.baseUrl;
        // Ensure the base URL ends with a slash for proper path joining
        if (!urlString.endsWith('/')) {
          urlString += '/';
        }
        // Append the normalized path
        urlString += normalizedPath;

        // Parse the constructed URL string
        const url = new URL(urlString);
        if (options.searchParams) {
          for (const [key, value] of Object.entries(options.searchParams)) {
            url.searchParams.set(key, String(value));
          }
        }

        // Set up headers
        const headers = new Headers(options.headers);
        headers.set('Authorization', `Bearer ${this.authToken}`);
        headers.set('Content-Type', 'application/json');

        // Create fetch options - exclude our custom properties
        const { searchParams, jsonBody, ...fetchOptions } = options;
        fetchOptions.headers = headers;

        // Handle JSON body if provided
        if (jsonBody !== undefined) {
          if (
            typeof jsonBody === 'object' &&
            jsonBody !== null &&
            !(jsonBody instanceof FormData) &&
            !(jsonBody instanceof Blob) &&
            !(jsonBody instanceof URLSearchParams) &&
            !(jsonBody instanceof ReadableStream)
          ) {
            // It's a plain object, stringify it
            fetchOptions.body = JSON.stringify(jsonBody);
          } else if (typeof jsonBody === 'string') {
            // It's already a string, use it directly
            fetchOptions.body = jsonBody;
          } else {
            // For FormData, Blob, etc., use it directly
            fetchOptions.body = jsonBody as BodyInit;
          }
        }

        // Make the request
        const response = await this.fetch(url.toString(), fetchOptions);

        // Handle error responses
        if (!response.ok) {
          let errorMessage: string;
          try {
            const errorData = (await response.json()) as SentryApiErrorResponse;
            errorMessage =
              errorData.detail ||
              errorData.message ||
              `API error (${response.status})`;
          } catch (e) {
            errorMessage = `API error: ${response.statusText} (${response.status})`;
          }

          lastStatus = response.status;
          // Create a SentryApiError directly with the status code
          lastError = new SentryApiError(errorMessage, response.status);

          // Check if this is a retryable status code
          if (
            retryableStatusCodes.includes(response.status) &&
            attempt < maxRetries
          ) {
            // Continue to the next attempt
            continue;
          }

          throw lastError;
        }

        // Parse and return the response
        return (await response.json()) as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // If we've already determined this is a retryable status code, continue to the next attempt
        if (
          lastStatus !== null &&
          retryableStatusCodes.includes(lastStatus) &&
          attempt < maxRetries
        ) {
          continue;
        }

        // If we're here, it's not a retryable error or we've exhausted retries
        // Convert any errors to SentryApiError for consistent handling
        if (error instanceof SentryApiError) {
          throw error;
        }

        throw new SentryApiError(
          `Sentry API request failed${attempt > 0 ? ` after ${attempt} retries` : ''}: ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }

    // This should never happen, but TypeScript requires a return
    throw new SentryApiError('Unexpected error in request method');
  }

  /**
   * Get a list of projects for the configured organization
   */
  async getProjects(): Promise<SentryProject[]> {
    return this.request<SentryProject[]>(`projects/`);
  }

  /**
   * Get a project by slug
   */
  async getProject(projectSlug: string): Promise<SentryProject> {
    return this.request<SentryProject>(
      `projects/${this.organization}/${projectSlug}/`
    );
  }

  /**
   * Get issues for a project
   */
  async getIssues(
    projectSlug: string,
    query?: Record<string, string | number>
  ): Promise<SentryIssue[]> {
    return this.request<SentryIssue[]>(
      `projects/${this.organization}/${projectSlug}/issues/`,
      query ? { searchParams: query } : {}
    );
  }

  /**
   * Get a specific issue
   *
   * @param projectSlug The slug of the project to get the issue from
   * @param issueId The ID of the issue to retrieve
   * @returns A promise that resolves to the requested issue
   */
  async getIssue(projectSlug: string, issueId: string): Promise<SentryIssue> {
    return this.request<SentryIssue>(
      `organizations/${this.organization}/issues/${issueId}/`,
      {
        searchParams: { project: projectSlug },
      }
    );
  }

  /**
   * Get a list of events for a specific issue
   *
   * @param issueId The ID of the issue to get events for
   * @param query Optional query parameters to filter and sort events
   * @returns A promise that resolves to an array of events
   */
  async getIssueEvents(
    issueId: string,
    query?: Record<string, string | number>
  ): Promise<SentryEvent[]> {
    return this.request<SentryEvent[]>(
      `organizations/${this.organization}/issues/${issueId}/events/`,
      query ? { searchParams: query } : {}
    );
  }

  /**
   * Get a specific event for an issue
   *
   * @param issueId The ID of the issue
   * @param eventId The ID of the event to retrieve, or one of the special values: 'latest', 'oldest', or 'recommended'
   * @returns A promise that resolves to the requested event
   */
  async getIssueEvent(issueId: string, eventId: string): Promise<SentryEvent> {
    return this.request<SentryEvent>(
      `organizations/${this.organization}/issues/${issueId}/events/${eventId}/`
    );
  }

  /**
   * Get a list of events for a specific project
   *
   * @param projectSlug The slug of the project to get events from
   * @param query Optional query parameters to filter and sort events
   * @returns A promise that resolves to an array of events
   */
  async getProjectEvents(
    projectSlug: string,
    query?: Record<string, string | number>
  ): Promise<SentryEvent[]> {
    return this.request<SentryEvent[]>(
      `organizations/${this.organization}/projects/${projectSlug}/events/`,
      query ? { searchParams: query } : {}
    );
  }

  /**
   * Get recent releases for the organization.
   *
   * Prefer server-side limiting by passing {@link GetReleasesOptions.limit},
   * which maps to the Sentry API's `per_page` parameter. Optionally pass a
   * {@link GetReleasesOptions.project} slug when the endpoint supports it.
   */
  async getReleases(options?: GetReleasesOptions): Promise<SentryRelease[]> {
    const searchParams: Record<string, string | number> = {};

    if (options?.limit !== undefined) {
      searchParams['per_page'] = options.limit;
    }

    if (options?.project) {
      searchParams['project'] = options.project;
    }

    return this.request<SentryRelease[]>(
      `organizations/${this.organization}/releases/`,
      { searchParams }
    );
  }

  /**
   * Create a new release
   */
  async createRelease(
    projectSlug: string,
    data: Partial<SentryRelease>
  ): Promise<SentryRelease> {
    // Ensure the projectSlug is included in the request data
    const requestData = {
      ...data,
      projects: data.projects || [projectSlug],
    };

    return this.request<SentryRelease>(
      `organizations/${this.organization}/releases/`,
      {
        method: 'POST',
        jsonBody: requestData,
      }
    );
  }

  /**
   * Get all tags for a project
   */
  async getTags(projectSlug: string): Promise<SentryTag[]> {
    return this.request<SentryTag[]>(
      `projects/${this.organization}/${projectSlug}/tags/`
    );
  }

  /**
   * Get values for a specific tag
   *
   * @param projectSlug The slug of the project to get tag values from
   * @param tagKey The key of the tag to get values for
   * @param options Optional parameters:
   *   - limit: Maximum number of tag values to return
   *   - query: Filter tag values with a "contains" match
   * @returns A promise that resolves to an array of tag values
   */
  async getTagValues(
    projectSlug: string,
    tagKey: string,
    options?:
      | {
          limit?: number;
          query?: string;
        }
      | number // Support legacy limit parameter for backward compatibility
  ): Promise<SentryTagValue[]> {
    const searchParams: Record<string, string | number> = {};

    // Handle both new options object and legacy limit parameter
    if (typeof options === 'number') {
      searchParams['limit'] = options;
    } else if (options) {
      if (options.limit !== undefined) {
        searchParams['limit'] = options.limit;
      }

      if (options.query !== undefined) {
        searchParams['query'] = options.query;
      }
    }

    return this.request<SentryTagValue[]>(
      `projects/${this.organization}/${projectSlug}/tags/${encodeURIComponent(tagKey)}/values/`,
      {
        searchParams,
      }
    );
  }

  /**
   * Get organization details
   */
  async getOrganization(): Promise<unknown> {
    return this.request<unknown>(`organizations/${this.organization}/`);
  }

  /**
   * Get the organization slug configured for this client
   * @returns The organization slug used for API requests
   */
  getOrganizationSlug(): string {
    return this.organization;
  }

  /**
   * Get the authentication token configured for this client
   * @returns The authentication token used for API requests
   */
  getAuthToken(): string {
    return this.authToken;
  }

  /**
   * Get the base URL configured for this client
   * @returns The base URL used for API requests
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Helper method to check if the API credentials are valid
   */
  async validateCredentials(): Promise<boolean> {
    try {
      await this.getOrganization();
      return true;
    } catch (error) {
      // Check for authentication errors (401)
      if (error instanceof SentryApiError && error.status === 401) {
        return false;
      }
      // For other errors (like 403 permissions), the token is valid
      if (error instanceof SentryApiError && error.status === 403) {
        return true;
      }
      // Re-throw other errors
      throw error;
    }
  }
}

/**
 * Extract a human-readable name from a team entry
 * @param team Team object or string
 * @returns A string representation of the team name
 */
export function getTeamName(
  team: string | Partial<SentryTeam> | unknown
): string {
  if (typeof team === 'string') return team;
  if (team && typeof team === 'object') {
    // Prioritize name for human readability, fall back to slug
    return (
      (team as Partial<SentryTeam>).name ||
      (team as Partial<SentryTeam>).slug ||
      String(team)
    );
  }
  return String(team);
}

/**
 * Get all team names from a project
 * @param project Sentry project object
 * @returns Array of team names associated with the project
 */
export function getTeamNames(project: SentryProject): string[] {
  const teamNames: string[] = [];

  // Process teams array if it exists
  if (project.teams) {
    if (Array.isArray(project.teams)) {
      teamNames.push(...project.teams.map((team) => getTeamName(team)));
    } else {
      teamNames.push(getTeamName(project.teams));
    }
  }

  // Process singular team property if it exists
  if (project.team) {
    teamNames.push(getTeamName(project.team));
  }

  return teamNames;
}

/**
 * Create a new Sentry API client with environment variables
 */
export function createSentryApiClient(config: SentryApiConfig): SentryApiClient {
  return new SentryApiClient(config);
}

export default createSentryApiClient;
