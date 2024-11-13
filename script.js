// script.js
window.onload = function() {
    // Function to get query parameter value
    function getQueryParam(param) {
        let urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    }

    // Get the values of "apikey", "orgId", and "projId" from the URL
    let apiKey = getQueryParam('apikey');
    let orgId = getQueryParam('orgId');
    let projId = getQueryParam('projId');
    let rssUrl = getQueryParam('rssUrl');

    // Store the values in local storage if they are present
    if (apiKey) localStorage.setItem('apikey', apiKey);
    if (orgId) localStorage.setItem('orgId', orgId);
    if (projId) localStorage.setItem('projId', projId);
    if (rssUrl) localStorage.setItem('rssUrl', rssUrl);

    // Set up the main container
    document.body.innerHTML = '<div style="padding:24px;"><h1>Top News</h1><p><ol id="main"></ol></p></div>';
    const mainDiv = document.getElementById('main');

    // OpenAI API URL
    const apiUrl = "https://api.openai.com/v1/chat/completions";
    //const rssUrl = 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en';
    const maxItems = 15;

    // Fetch the Google News RSS feed
    fetch(rssUrl)
        .then(response => {
            if (!response.ok) throw new Error("Failed to fetch RSS feed");
            return response.text();
        })
        .then(str => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(str, "text/xml");
            const items = Array.from(xmlDoc.getElementsByTagName("item")).slice(0, maxItems);
            //const items = Array.from(xmlDoc.getElementsByTagName("item"));

            // Iterate over each RSS item and send the description to the OpenAI API
            items.forEach(item => {
                let description = item.getElementsByTagName("description")[0].textContent;

                // Strip HTML tags from the description
                const tmp = document.createElement("div");
                tmp.innerHTML = description;
                description = tmp.textContent || tmp.innerText || "";

                // Create the prompt for the API
                const prompt = `Summarize the INPUT TEXT in one concise 1 or 2 sentence summary without newlines.
                                At the end, in parentheses put the first news source mentioned in the description.
                                Do not write any text after the source in parentheses.
                                Strongly avoid HTML or Markdown formatting or any http links in the summaries. 
                                Put bold <b> HTML tags around important words and keywords in the summaries.
                                Highlight key words and phrases (e.g., names, institutes, locations, amounts) with 
                                bold in the following text except news source at the end.
                                At least 1 word must be made bold per summary. 
                                IMPORTANT USE HTML <b> not Markdown tags!!!
                                Example: <b>Biden</b> visited <b>Vietnam</b> today. 
                                INPUT TEXT: ${description}`;

                console.log("Prompt sent: " + prompt);

                // API request data
                const data = {
                    model: "gpt-4o-mini",
                    messages: [
                        { role: "system", content: "You are a helpful assistant." },
                        { role: "user", content: prompt }
                    ]
                };

                // Send the request to OpenAI
                fetch(apiUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${apiKey}`,
                        "OpenAI-Organization": orgId,
                        "OpenAI-Project": projId
                    },
                    body: JSON.stringify(data)
                })
                .then(response => {
                    if (!response.ok) throw new Error("API request failed");
                    return response.json();
                })
                .then(apiData => {
                    let summary = apiData.choices[0].message.content;
                    //summary = summary.replace(/\*\*/g, '');
                    summary = summary.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

                    const listItem = document.createElement("li");
                    listItem.innerHTML = summary;
                    listItem.style.marginBottom = "10px";
                    mainDiv.appendChild(listItem);
                })
                .catch(error => {
                    console.error("Error fetching summary:", error);
                });
            });
        })
        .catch(error => {
            console.error("Error fetching RSS feed:", error);
        });
};
