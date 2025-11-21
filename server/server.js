require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

const API_KEY = process.env.RIOT_API_KEY;
const PORT = process.env.PORT || 3000; // Standardowo 3000, ale 3001 też zadziała

// Helper: Mapowanie regionu LoL na region Routing (dla Account-V1)
const getRoutingValue = (region) => {
    const mapping = {
        'eun1': 'europe', 'euw1': 'europe', 'tr1': 'europe', 'ru': 'europe',
        'na1': 'americas', 'br1': 'americas', 'la1': 'americas', 'la2': 'americas',
        'kr': 'asia', 'jp1': 'asia'
    };
    return mapping[region] || 'europe';
};

// Endpoint 1: Wyszukaj gracza i pobierz jego statystyki
app.get('/api/player/:region/:gameName/:tagLine', async (req, res) => {
    try {
        const { region, gameName, tagLine } = req.params;
        const routing = getRoutingValue(region);

        console.log(`[PROFIL] Szukam: ${gameName}#${tagLine} (${region})`);

        // 1. Account V1 - Pobierz PUUID
        const accountUrl = `https://${routing}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${gameName}/${tagLine}`;
        const accountRes = await axios.get(accountUrl, { headers: { "X-Riot-Token": API_KEY } });
        const { puuid, gameName: realName,QS_tagLine: realTag } = accountRes.data;

        // 2. Summoner V4 - Pobierz ID i Level (używając PUUID)
        const summonerUrl = `https://${region}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`;
        const summonerRes = await axios.get(summonerUrl, { headers: { "X-Riot-Token": API_KEY } });
        const summonerData = summonerRes.data;

        // 3. League V4 - Pobierz rangę (używając SummonerID)
        const leagueUrl = `https://${region}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerData.id}`;
        const leagueRes = await axios.get(leagueUrl, { headers: { "X-Riot-Token": API_KEY } });

        const soloQ = leagueRes.data.find(q => q.queueType === "RANKED_SOLO_5x5");

        res.json({
            puuid: puuid,
            id: summonerData.id,
            name: `${accountRes.data.gameName} #${accountRes.data.tagLine}`,
            level: summonerData.summonerLevel,
            iconId: summonerData.profileIconId,
            rank: soloQ ? `${soloQ.tier} ${soloQ.rank}` : "Unranked",
            lp: soloQ ? soloQ.leaguePoints : 0,
            wins: soloQ ? soloQ.wins : 0,
            losses: soloQ ? soloQ.losses : 0
        });

    } catch (error) {
        // Logowanie błędu, żebyś widział w konsoli co jest nie tak
        console.error("Błąd /api/player:", error.response?.status, error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ error: "Gracz nie znaleziony lub błąd API" });
    }
});

// Endpoint 2: Sprawdź czy gracz jest w meczu (Live Game)
// UWAGA: Zmieniono na :puuid i V5 API, bo frontend wysyła PUUID
app.get('/api/live/:region/:puuid', async (req, res) => {
    try {
        const { region, puuid } = req.params;

        console.log(`[LIVE] Sprawdzam mecz dla PUUID: ${puuid} (${region})`);

        // Używamy SPECTATOR-V5, który obsługuje PUUID (V4 wymaga encryptedSummonerId)
        const liveUrl = `https://${region}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${puuid}`;

        const liveRes = await axios.get(liveUrl, { headers: { "X-Riot-Token": API_KEY } });

        res.json({
            inGame: true,
            mode: liveRes.data.gameMode,
            type: liveRes.data.gameType,
            startTime: liveRes.data.gameStartTime,
            participants: liveRes.data.participants.map(p => ({
                championId: p.championId,
                teamId: p.teamId,
                // riotId może nie być dostępny w spectator v5 od razu, ale puuid jest
                puuid: p.puuid, 
                summonerId: p.summonerId
            }))
        });

    } catch (error) {
        if (error.response && error.response.status === 404) {
            // 404 od Riotu tutaj oznacza "Gracz nie jest w grze" - to normalne
            res.json({ inGame: false });
        } else {
            console.error("Błąd /api/live:", error.response?.status, error.response?.data || error.message);
            res.status(500).json({ error: "Błąd sprawdzania meczu" });
        }
    }
});

app.listen(PORT, () => {
    console.log(`Serwer DeepLol Proxy działa na porcie ${PORT}`);
});