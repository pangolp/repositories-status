new Vue({
    el: '#app',
    data () {
      return {
        repositories: 'no found',
        loading: true
      }
    },
    mounted () {
        setTimeout(() => {
            axios
                .get('https://api.github.com/orgs/azerothcore/repos?per_page=100;sort=updated;direction=desc')
                .then(response => {this.repositories = response.data})
                .catch(error => {console.log(error)})
                .finally(() => this.loading = false);
        }, 10000)
    }
})
