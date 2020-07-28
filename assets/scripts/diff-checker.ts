/**
 * Receives task to check for changes from background script
 * After comparison, send the diff results to background script
 */
class DiffChecker {

    constructor() {
        this.init();
    }

    init() {
        //receive the tab data
        chrome.runtime.onMessage.addListener(((task: watchlistTask, sender, sendResponse) => {
            if (task && task.alarmId && task.data) {
                this.processDiffCheckerTask(task);
                sendResponse('ok')
            } else {
                sendResponse('error')
            }
        }));

    }

    processDiffCheckerTask(task: watchlistTask) {
        let differences = this.checkDiff(task);
        if (differences && differences.length > 0) {
            const message: watchlistTaskDiff = {
                type: 'diffCheck',
                hasChanged: true,
                changes: differences,
                alarmId: task.alarmId || '',
                website: location.href,
                title: document.title
            };
            //send message of the differences
            chrome.runtime.sendMessage(message)
            //close the tab
            window.close();
        } else {
            //send message notifying there is no difference
            const message: watchlistTaskDiff = {
                type: 'diffCheck',
                hasChanged: false,
                alarmId: task.alarmId || '',
                changes: [],
                website: location.href,
                title: document.title
            };
            chrome.runtime.sendMessage(message);
            //close the tab
            window.close();
        }

    }

    checkDiff(d: watchTaskData): taskDiffData[] {
        let diff: taskDiffData[] = [], elem: Node | null;
        d.data.forEach((obj) => {
            elem = this.getElemByXpath(obj.xpath);
            console.log(elem?.textContent);

            if (elem && elem.textContent != obj.text) {
                diff.push({current: elem.textContent || "", original: obj.text || "", time: new Date().getTime()})
            }
        });

        return diff;
    }

    getElemByXpath(path: any) {
        let evaluator = new XPathEvaluator();
        return (evaluator.evaluate(path, document.documentElement, null,
            XPathResult.FIRST_ORDERED_NODE_TYPE, null)).singleNodeValue;
    }
}

new DiffChecker();

