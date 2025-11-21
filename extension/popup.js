document.addEventListener('DOMContentLoaded', () => {
    const inputName = document.getElementById('inputName');
    const selectRegion = document.getElementById('selectRegion');
    const btnSearch = document.getElementById('btnSearch');
    const btnCheckLive = document.getElementById('btnCheckLive');

    const loader = document.getElementById('loader');
    const errorMsg = document.getElementById('errorMsg');
    const profileSection = document.getElementById('profileSection');
    const liveGameSection = document.getElementById('liveGameSection');

    // Elementy profilu
    const profileIcon = document.getElementById('profileIcon');
    const profileName = document.getElementById('profileName');
    const profileLevel = document.getElementById('profileLevel');
    const rankTier = document.getElementById('rankTier');
    const rankText = document.getElementById('rankText');
    const winRate = document.getElementById('winRate');

    // Elementy live game
    const liveStatus = document.getElementById('liveStatus');
    const liveParticipants = document.getElementById('liveParticipants');

    // Konfiguracja
    const API_URL = "http://localhost:3000/api";
    
    // Zmieniono na PUUID zgodnie z nowym API
    let currentPuuid = null;
    let currentRegion = null;

    const show = (el) => el.classList.remove('hidden');
    const hide = (el) => el.classList.add('hidden');

    const parseNameTag = (input) => {
        if (!input.includes('#')) {
            throw new Error('Podaj nick w formacie: Nick#Tag');
        }
        const [name, tag] = input.split('#');
        return { name, tag };
    };

    // 1. POBIERANIE DANYCH GRACZA
    const fetchPlayerData = async (region, name, tag) => {
        try {
            show(loader);
            hide(errorMsg);
            hide(profileSection);
            hide(liveGameSection);

            const response = await fetch(`${API_URL}/player/${region}/${name}/${tag}`);

            if (!response.ok) {
                throw new Error(`Nie znaleziono gracza (Błąd: ${response.status})`);
            }

            const data = await response.json();

            // Zapisujemy PUUID zamiast ID
            currentPuuid = data.puuid;
            currentRegion = region;

            // Aktualizacja UI
            // Używamy nowszej wersji DataDragon (14.22.1)
            profileIcon.src = `https://ddragon.leagueoflegends.com/cdn/14.22.1/img/profileicon/${data.iconId}.png`;
            profileName.textContent = data.name;
            profileLevel.textContent = data.level;
            
            // Obsługa braku rangi
            if (data.rank === "Unranked") {
                rankTier.textContent = "UNRANKED";
                rankText.textContent = "Brak gier rankingowych";
                winRate.textContent = "";
            } else {
                rankTier.textContent = data.rank.split(' ')[0];
                rankText.textContent = data.rank + ` (${data.lp} LP)`;
                const totalGames = data.wins + data.losses;
                const wr = totalGames > 0 ? ((data.wins / totalGames) * 100).toFixed(0) : 0;
                winRate.textContent = `${wr}% Winrate (${data.wins}W / ${data.losses}L)`;
            }

            show(profileSection);
        } catch (e) {
            errorMsg.textContent = e.message;
            show(errorMsg);
        } finally {
            hide(loader);
        }
    };

    // 2. SPRAWDZANIE MECZU LIVE
    const fetchLiveGame = async () => {
        if (!currentPuuid || !currentRegion) {
            errorMsg.textContent = "Najpierw wyszukaj gracza.";
            show(errorMsg);
            return;
        }

        try {
            btnCheckLive.innerText = "Sprawdzanie...";
            hide(errorMsg);
            // Nie ukrywamy sekcji profilu, tylko dodajemy info o grze pod spodem

            // Endpoint używa teraz PUUID
            const response = await fetch(`${API_URL}/live/${currentRegion}/${currentPuuid}`);

            if (!response.ok) {
                throw new Error(`Błąd połączenia live: ${response.status}`);
            }

            const data = await response.json();

            if (!data.inGame) {
                liveStatus.textContent = "Gracz nie jest obecnie w grze.";
                liveStatus.style.color = "#c8aa6e"; // Gold
                liveParticipants.innerHTML = '';
                show(liveGameSection);
                return;
            }

            // Gracz jest w grze
            liveStatus.textContent = `W GRZE: ${data.mode} (${Math.floor(data.startTime / 60)} min)`;
            liveStatus.style.color = "#0acbe6"; // Cyan

            liveParticipants.innerHTML = '';

            data.participants.forEach(p => {
                const li = document.createElement('li');
                // Prosty tekst, bo API proxy nie zwraca nazw championów (tylko ID)
                // Żeby mieć nazwy, trzeba by pobrać JSON z DataDragon w tle
                const isMe = p.puuid === currentPuuid ? "(TO TY)" : "";
                
                li.innerHTML = `
                    <span style="color: ${p.teamId === 100 ? '#4fa3ff' : '#e35959'}">
                        Team ${p.teamId === 100 ? 'Blue' : 'Red'}
                    </span> 
                    - ChampID: <strong>${p.championId}</strong> ${isMe}
                `;
                liveParticipants.appendChild(li);
            });

            show(liveGameSection);

        } catch (e) {
            errorMsg.textContent = "Nie udało się pobrać statusu meczu.";
            show(errorMsg);
        } finally {
            btnCheckLive.innerText = "Sprawdź czy gra (Live Game)";
        }
    };

    // Obsługa przycisków
    btnSearch.addEventListener('click', () => {
        const val = inputName.value.trim();
        if(!val) return;
        
        try {
            const { name, tag } = parseNameTag(val);
            const region = selectRegion.value;
            fetchPlayerData(region, name, tag);
        } catch (e) {
            errorMsg.textContent = e.message;
            show(errorMsg);
        }
    });

    btnCheckLive.addEventListener('click', fetchLiveGame);
});