new Vue({
    el: '#app',
    data () {
      return {
        repositories: [],
        loading: true,
        error: null,
        searchQuery: '',
        showOnlyActive: true,
        loadingProgress: {
            current: 0,
            total: 0,
            percentage: 0
        },
        cacheInfo: {
            isFromCache: false,
            lastUpdate: null,
            expiresAt: null
        }
      }
    },
    computed: {
        filteredRepositories() {
            let filtered = this.repositories

            if (this.showOnlyActive) {
                filtered = filtered.filter(repo => repo.open_issues_count > 0)
            }

            if (this.searchQuery) {
                const query = this.searchQuery.toLowerCase().trim()
                filtered = filtered.filter(repo => {
                    const name = repo.name ? repo.name.toLowerCase() : ''
                    const description = repo.description ? repo.description.toLowerCase() : ''
                    const topics = repo.topics ? repo.topics.join(' ').toLowerCase() : ''

                    return name.includes(query) || 
                           description.includes(query) || 
                           topics.includes(query)
                })
            }

            filtered.sort((a, b) => 
                b.open_issues_count - a.open_issues_count
            );

            return filtered
        },

        repositoryCount() {
            return {
                total: this.repositories.length,
                filtered: this.filteredRepositories.length,
                withActivity: this.repositories.filter(r => r.open_issues_count > 0).length
            }
        },

        statsOverview() {
            const repos = this.filteredRepositories
            return {
                totalIssues: repos.reduce((sum, repo) => sum + repo.open_issues_count, 0),
                totalStars: repos.reduce((sum, repo) => sum + repo.stargazers_count, 0),
                totalForks: repos.reduce((sum, repo) => sum + repo.forks_count, 0),
                reposWithIssues: repos.filter(r => r.open_issues_count > 0).length
            }
        },

        cacheStatus() {
            if (!this.cacheInfo.lastUpdate) return null

            const now = new Date()
            const lastUpdate = new Date(this.cacheInfo.lastUpdate)
            const expiresAt = new Date(this.cacheInfo.expiresAt)

            const minutesAgo = Math.floor((now - lastUpdate) / 1000 / 60)
            const minutesUntilExpiry = Math.floor((expiresAt - now) / 1000 / 60)

            return {
                minutesAgo,
                minutesUntilExpiry,
                isExpired: now > expiresAt
            }
        }
    },

    methods: {
        clearSearch() {
            this.searchQuery = ''
        },

        toggleActiveFilter() {
            this.showOnlyActive = !this.showOnlyActive
        },

        getCacheKey() {
            return 'azerothcore_repositories_cache'
        },

        saveToCache(repositories) {
            try {
                const now = new Date()
                const expiresAt = new Date(now.getTime() + 60 * 60 * 1000)

                const cacheData = {
                    repositories: repositories,
                    timestamp: now.toISOString(),
                    expiresAt: expiresAt.toISOString(),
                    version: '1.0'
                }

                localStorage.setItem(this.getCacheKey(), JSON.stringify(cacheData))

                this.cacheInfo.lastUpdate = now.toISOString()
                this.cacheInfo.expiresAt = expiresAt.toISOString()

                console.log(`✓ Cached ${repositories.length} repositories (expires in 60 minutes)`)
            } catch (error) {
                console.warn('Failed to save to cache:', error)
            }
        },

        loadFromCache() {
            try {
                const cachedData = localStorage.getItem(this.getCacheKey())

                if (!cachedData) {
                    console.log('ℹ No cache found')
                    return null
                }

                const cache = JSON.parse(cachedData)
                const now = new Date()
                const expiresAt = new Date(cache.expiresAt)

                if (now > expiresAt) {
                    console.log('ℹ Cache expired, removing...')
                    localStorage.removeItem(this.getCacheKey())
                    return null
                }

                if (cache.version !== '1.0') {
                    console.log('ℹ Cache version mismatch, removing...')
                    localStorage.removeItem(this.getCacheKey())
                    return null
                }

                this.cacheInfo.isFromCache = true
                this.cacheInfo.lastUpdate = cache.timestamp
                this.cacheInfo.expiresAt = cache.expiresAt

                const minutesAgo = Math.floor((now - new Date(cache.timestamp)) / 1000 / 60)
                console.log(`✓ Loaded ${cache.repositories.length} repositories from cache (${minutesAgo} minutes old)`)
                return cache.repositories
            } catch (error) {
                console.warn('Failed to load from cache:', error)
                localStorage.removeItem(this.getCacheKey())
                return null
            }
        },

        clearCache() {
            localStorage.removeItem(this.getCacheKey())
            console.log('✓ Cache cleared')
            location.reload()
        },

        async fetchAllRepositories(forceRefresh = false) {
            try {
                if (!forceRefresh) {
                    const cachedRepos = this.loadFromCache()
                    if (cachedRepos) {
                        this.repositories = cachedRepos
                        this.loading = false
                        return
                    }
                }

                let allRepos = []
                let page = 1
                let hasMore = true
                const perPage = 100

                while (hasMore) {
                    this.loadingProgress.current = page

                    const response = await axios.get(
                        `https://api.github.com/orgs/azerothcore/repos?per_page=${perPage}&page=${page}&sort=updated&direction=desc`
                    )

                    const repos = response.data

                    if (repos.length === 0) {
                        hasMore = false
                    } else {
                        allRepos = allRepos.concat(repos)
                        
                        if (repos.length < perPage) {
                            hasMore = false
                        } else {
                            page++
                        }
                    }
                    this.loadingProgress.percentage = Math.round((allRepos.length / 300) * 100)
                }

                this.repositories = allRepos
                this.error = null

                this.saveToCache(allRepos)

                console.log(`✓ Loaded ${allRepos.length} repositories from API`)
                console.log(`✓ ${this.repositoryCount.withActivity} repositories with open issues/PRs`)

            } catch (error) {
                console.error('Error fetching repositories:', error)
                if (error.response) {
                    this.error = `Server error: ${error.response.status} - ${error.response.statusText}`
                } else if (error.request) {
                    this.error = 'Network error: Unable to reach GitHub API. Please check your connection.'
                } else {
                    this.error = 'An unexpected error occurred. Please try again later.'
                }
                this.repositories = []
            } finally {
                this.loading = false
            }
        },

        async refreshData() {
            this.loading = true
            this.cacheInfo.isFromCache = false
            await this.fetchAllRepositories(true)
        }
    },

    mounted () {
        this.fetchAllRepositories()
    }
})
