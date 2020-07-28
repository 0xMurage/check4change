/**
 * Script to control what/when user task selections on an iframe.
 * Events are channeled to the selection content script for processing
 */
class Iframe {

    constructor() {
        this.eventsHandler();
    }


    private eventsHandler() {
        let saveBtn = document.getElementById('selection-action-end'),
            exitBtn = document.getElementById('selection-action-exit');
        //save selections

        if (saveBtn) {
            saveBtn.addEventListener('click', () => {

                //fire message to end the process
                chrome.tabs.getCurrent((tab) => {
                    parent.postMessage({action: 'endSelection'}, tab?.url || '*')

                })

            }, false);
        }

        if (exitBtn) {
            exitBtn.addEventListener('click', () => {
                //fire message to exit the process
                chrome.tabs.getCurrent((tab) => {
                    parent.postMessage({action: 'exitSelection'}, tab?.url || '*')

                })

            }, false);
        }


        /*
        listen to any messages with action
         */
        chrome.runtime.onMessage.addListener((message, sender, resp) => {
            if (!message || !message.action || !message.data) return;
            if (message.action == 'add') {
                this.renderUserXPathSelections(message.data);
            }
        })
    }

    renderUserXPathSelections(data: watchablePath) {
        let table = document.querySelector('#table-selection-paths tbody');
        if (table) {
            table.insertAdjacentHTML('beforeend', `<tr><td> <input type="text" class="input" value="${data.xpath}"></td></tr>`)
        }
        let textContent = document.querySelector('#selection-text-content');
        if (textContent) {
            textContent.innerHTML = data.text || '';
        }
    }
}

new Iframe();
