class Selector {

    private allowedPrimaryElements = ['DIV', 'P', 'SPAN', 'A', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SECTION', 'PRE'];
    private highlighterClass = 'highlight-css-34ji43f';
    private selectedClass = 'selected-css-df3joe2jo';
    private prevHighlightedElem: HTMLElement | null = null;
    private selectionData!: watchTaskData;
    private selectionIframeId = 'checkForChangeIframeX2X3';
    private selectorStyleSheetFileId = 'selector-css-3ei8ey3';
    private originalBodyMarginBottom = '0px';
    private selectorOnMouseMove;
    private selectorOnMouseClick;

    constructor() {
        this.selectorOnMouseMove = this.evtOnMouseMove.bind(this);
        this.selectorOnMouseClick = this.evtOnMouseClick.bind(this);
        this.originalBodyMarginBottom = document.body.style.marginBottom;
        this.injectSelectionIframe();
        this.injectSelectorStyles();
        this.evtInit();
    }

    evtInit() {
        // mouse over for highlighting
        document.addEventListener('mousemove', this.selectorOnMouseMove, false);


        window.addEventListener('message', (evt) => {
            if (!evt.data) {
                return
            }
            if (evt.data.action == 'endSelection') {         //listen for save message
                this.endSelectionProcess();
            } else if (evt.data.action == 'exitSelection') { //listen for exit message
                this.exitSelectionProcess();
            }
        });


    }

    evtOnMouseMove(evt) {

        evt.stopPropagation();
        evt.preventDefault();
        let currentElem: HTMLElement = evt.srcElement;

        /*
        ignore previously selected element, if ==current element, or is not allowed tag
        * */
        if (this.prevHighlightedElem == currentElem ||
            currentElem.classList.contains(this.selectedClass) ||
            !this.isAllowedTag(currentElem)) {
            return
        }

        if (this.prevHighlightedElem != null) {
            /*
                relieve previous element of its duties i.e
                remove highlighter class and click event
             */
            this.prevHighlightedElem.classList.remove(this.highlighterClass);
            this.prevHighlightedElem.removeEventListener('click', this.selectorOnMouseClick, false);

        }

        //Now add the current focused element the highlighter class
        currentElem.classList.add(this.highlighterClass);

        //attach click event to the element
        currentElem.addEventListener('click', this.selectorOnMouseClick, false);

        //the current item becomes previous item
        this.prevHighlightedElem = currentElem;


    }

    /**
     * When selected element is clicked:
     *  1. get the element Xpath
     *  2. add selected class
     *
     * @param evt
     */
    evtOnMouseClick(evt) {
        evt.stopPropagation();
        evt.preventDefault();

        let elem: HTMLElement = evt.srcElement;
        this.addSelectedPathToWatch({xpath: this.getXpath(elem), text: elem.textContent});
        elem.classList.add(this.selectedClass);
    }

    isAllowedTag(elem: HTMLElement) {
        return this.allowedPrimaryElements.findIndex((tag) => tag.toUpperCase() === elem.nodeName.toUpperCase()) > -1;
    }

    getXpath(elem: HTMLElement | any): string {
        elem.classList.remove(this.highlighterClass);
        elem.classList.remove(this.selectedClass);

        let segments: string[] = [];
        let docNodes = document.getElementsByTagName('*');

        for (segments; elem && elem.nodeType == 1; elem = elem.parentNode) {
            if (elem.hasAttribute('id') && elem.getAttribute('id')) {
                let uniqueIdCount = 0;
                for (let i = 0; i < docNodes.length; i++) {
                    if (docNodes[i].hasAttribute('id') && docNodes[i].id == elem.id) {
                        uniqueIdCount++
                    }
                    if (uniqueIdCount > 1) {
                        break
                    }
                }
                if (uniqueIdCount == 1) {
                    segments.unshift(`id('${elem.getAttribute('id')}')`);
                    return segments.join('/')
                }
                segments.unshift(`${elem.localName.toLowerCase()}[@id='${elem.getAttribute('id')}']`)

            } else if (elem.hasAttribute('class') && elem.getAttribute('class')
                && elem.parentNode.childNodes.length < 2) {
                segments.unshift(`${elem.localName.toLowerCase()}[@class='${elem.getAttribute('class')}']`)
            } else {
                let x = 1;
                let sib;
                for (sib = elem.previousSibling; sib; sib = sib.previousSibling) {
                    if (sib.localName == elem.localName) {
                        x++;
                    }
                }
                segments.unshift(`${elem.localName.toLowerCase()}[${x}]`);
            }
        }

        return segments.length ? '/' + segments.join('/') : '';
    }


    private addSelectedPathToWatch(d: watchablePath) {

        if (!this.selectionData) {
            this.selectionData = {title: document.title, url: window.location.href, data: [], type: 'watchTask'};
            this.selectionData.data.push(d);
            chrome.runtime.sendMessage({data: d, action: 'add'}); //broadcast the contents {will be intercepted by Iframe.js}
            return
        }

        if (this.selectionData.data.findIndex(da => da.xpath == d.xpath) == -1) {
            this.selectionData.data.push(d);
            chrome.runtime.sendMessage({data: d, action: 'add'}); //broadcast the contents {will be intercepted by Iframe.js}
        }
    }


    private endSelectionProcess() {
        // send the watch data to background script. If success, exit the selection process
        chrome.runtime.sendMessage(this.selectionData, (resp) => {
            this.exitSelectionProcess();
        });
        this.exitSelectionProcess();//in-case there is not callback response
    }

    private injectSelectionIframe() {
        let iframe = document.createElement('iframe');
        iframe.id = this.selectionIframeId;
        iframe.style.height = '300px';
        iframe.style.width = '100%';
        iframe.style.position = 'fixed';
        iframe.style.bottom = '0';
        iframe.style.right = '0';
        iframe.style.zIndex = '2147483647';
        iframe.style.boxShadow = 'rgba(0, 0, 0, 0.4) -4px -4px 16px 0px';
        iframe.src = chrome.extension.getURL('pages/selection-frame.html');
        //toggle the body margin
        this.toggleBodyStyles();
        document.body.appendChild(iframe);
    }

    private injectSelectorStyles() {
        let style = document.createElement('link');
        style.href = chrome.extension.getURL('assets/styles/selector.css');
        style.type = 'text/css';
        style.id = this.selectorStyleSheetFileId;
        style.rel = "stylesheet";
        document.body.appendChild(style);
    }

    private exitSelectionProcess() {
        //1. remove the mouse over lister
        document.removeEventListener('mousemove', this.selectorOnMouseMove, false);


        //2. remove selected Class
        document.querySelectorAll(`.${this.selectedClass}`).forEach((elem) => {
            elem.classList.remove(this.selectedClass);
        });

        //3. remove iframe
        let iframe = document.getElementById(this.selectionIframeId);
        if (iframe) {
            iframe.remove();
        }

        //4. remove the css stylesheet
        let cssExt = document.querySelector(`#${this.selectorStyleSheetFileId}`);
        if (cssExt) cssExt.remove();

    }

    private toggleBodyStyles() {
        document.body.style.marginBottom === this.originalBodyMarginBottom
            ? document.body.style.marginBottom = '300px' :
            document.body.style.marginBottom = this.originalBodyMarginBottom;

        document.body.style.overflowX == 'scroll' ? document.body.style.overflowX = 'inherit' :
            document.body.style.overflowX == 'scroll'
    }

}

new Selector();

