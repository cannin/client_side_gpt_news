window.onload = function() {
    // Function to get query parameter value
    function getQueryParam(param) {
        let urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    }

    // Function to get value from localStorage or query param
    function getParamValue(param) {
        let value = getQueryParam(param);
        if (value) {
            localStorage.setItem(param, value);
        } else {
            value = localStorage.getItem(param);
        }
        if (!value) {
            console.error(`ERROR: ${param} is not provided and not found in localStorage`);
        }
        return value;
    }

    // Get values from query params or localStorage
    let apiKey = getParamValue('apikey');
    let orgId = getParamValue('orgId');
    let projId = getParamValue('projId');
    let rssUrl = getParamValue('rssUrl');
    let decodingUrl = getParamValue('decodingUrl');

    // If any of the required parameters are missing, stop execution
    if (!apiKey || !orgId || !projId || !rssUrl || !decodingUrl) {
        if (!apiKey) console.error("ERROR: Missing: apiKey");
        if (!orgId) console.error("ERROR: Missing: orgId");
        if (!projId) console.error("ERROR: Missing: projId");
        if (!rssUrl) console.error("ERROR: Missing: rssUrl");
        if (!decodingUrl) console.error("ERROR: Missing: decodingUrl");
        return;
    }

    // Set up the main container
    const mainDiv = document.getElementById('main');

    // OpenAI API URL
    const apiUrl = "https://api.openai.com/v1/chat/completions";
    const maxItems = 15;

    // Fetch the Google News RSS feed
    fetch(rssUrl)
        .then(response => {
            if (!response.ok) throw new Error("ERROR: Failed to fetch RSS feed");
            return response.text();
        })
        .then(str => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(str, "text/xml");
            const items = Array.from(xmlDoc.getElementsByTagName("item")).slice(0, maxItems);

            // Iterate over each RSS item and send the description to the OpenAI API
            items.forEach(item => {
                let description = item.getElementsByTagName("description")[0].textContent;
                let link = item.getElementsByTagName("link")[0].textContent;
                link = link.replace("?oc=5", "");

                // Strip HTML tags from the description
                const tmp = document.createElement("div");
                tmp.innerHTML = description;
                description = tmp.textContent || tmp.innerText || "";

                // Create the prompt for the API
                const prompt = `Summarize the INPUT TEXT in one concise 1 or 2 sentence without newlines.
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

                console.log("Prompt: " + prompt);

                // API request data
                const data = {
                    model: "gpt-4o-mini",
                    messages: [
                        { role: "system", content: "You are a helpful assistant." },
                        { role: "user", content: prompt }
                    ]
                };

                // Make both OpenAI and decoding API requests in parallel
                Promise.all([
                    fetch(apiUrl, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${apiKey}`,
                            "OpenAI-Organization": orgId,
                            "OpenAI-Project": projId
                        },
                        body: JSON.stringify(data)
                    }),
                    fetch(`${decodingUrl}?url=${encodeURIComponent(link)}`)
                ])
                .then(responses => {
                    const [openAiResponse, decodingResponse] = responses;

                    if (!openAiResponse.ok) throw new Error("ERROR: API request to OpenAI failed");
                    if (!decodingResponse.ok) decodedLink = "";

                    return Promise.all([openAiResponse.json(), decodingResponse.text()]);
                })
                .then(([apiData, decodedLink]) => {
                    // Strip start and ending quotes from decodedLink
                    decodedLink = decodedLink.replace(/^"|"$/g, "");

                    let summary = apiData.choices[0].message.content;
                    summary = summary.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
                    if (decodedLink && decodedLink.trim() !== "") {
                        summary += ` <a href='${decodedLink}' target='_blank'>[Link]</a>`;
                    }

                    const listItem = document.createElement("li");
                    listItem.innerHTML = summary;
                    mainDiv.appendChild(listItem);
                })
                .catch(error => {
                    console.error("ERROR: Fetching summary or decoding link:", error);
                });
            });
        })
        .catch(error => {
            console.error("ERROR: Fetching RSS feed:", error);
        });
};
