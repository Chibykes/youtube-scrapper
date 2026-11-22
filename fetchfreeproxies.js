fetch(
  "https://good-proxies.com/ajax_fetch_proxies.php?count=10&ping=8000&time=0&page=1&per_page=10&free=1&_token=7c8db72ee2abd3f24e867397b7c868c8fd3706fa7e6b4939728e02ddcc1d743d",
  {
    headers: {
      accept: "*/*",
      "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
      "cache-control": "no-cache",
      pragma: "no-cache",
      priority: "u=1, i",
      "x-requested-with": "XMLHttpRequest",
      cookie:
        "PHPSESSID=d79ac692b6a9b72276ae7ed5fe78fb93; cookie_consent=accepted; __zlcmid=1aboyV7Cgn1AbIO",
      Referer: "https://good-proxies.com/en/proxy-list/free/",
    },
    body: null,
    method: "GET",
  }
)
  .then((response) => response.json())
  .then((data) => {
    // console.log(data);
    data?.data
      ?.filter((ip) => ip.smtp === 1 && ["socks5", "socks4"].includes(ip.type))
      ?.forEach((ip) => console.log(ip.ip));
  })
  .catch((error) => console.error(error));
