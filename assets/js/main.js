new Vue({
    el: '#app',
    data () {
      return {
        repositories: 'no found',
      }
    },
    mounted () {
      axios
        .get('https://api.github.com/orgs/azerothcore/repos?per_page=100;sort=updated;direction=desc')
        .then(response => (this.repositories = response.data))
    }
})
