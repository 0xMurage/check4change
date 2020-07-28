class MainClass {

    constructor() {
        this.initEvents();
    }

    initEvents() {
        let btnSelect = document.getElementById('action-select');
        if (btnSelect) {
            btnSelect.addEventListener('click', () => this.injectDomSelectorScript())
        }

        (<HTMLButtonElement>document.getElementById('action-watchlist')).addEventListener('click', () => {
            chrome.tabs.create({url: '/pages/inbox.html'})

        })

    }

    injectDomSelectorScript() {
        chrome.tabs.executeScript({
            file: 'assets/scripts/selector.js'
        });
        //close the popup
        window.close()
    }

}

document.addEventListener('DOMContentLoaded', () => {

    new MainClass();
});
