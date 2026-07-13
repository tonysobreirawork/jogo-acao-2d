# Auto Rogue: Fronteiras

Protótipo jogável de ação e plataforma 2D feito apenas com HTML, CSS e JavaScript, sem bibliotecas externas.

## Como executar

1. Extraia os arquivos.
2. Abra `index.html` em um navegador moderno.
3. O progresso é salvo automaticamente no `localStorage` do navegador.

Também pode ser executado com um servidor local:

```bash
python -m http.server 8080
```

Depois abra `http://localhost:8080`.

## Controles

- `A/D` ou setas: mover
- `W`, seta para cima ou `Espaço`: pular
- `Shift`: esquivar
- `P` ou `Esc`: pausar

## Sistemas incluídos

- Combate automático com priorização de alvo e verificação de linha de visão
- Salas sequenciais, portas bloqueadas e bônus após cada sala
- 20 bônus com sinergias de explosão, veneno, crítico, defesa, projéteis e movimento
- Três mundos temáticos: lava, neve e deserto
- Chefes com três fases e ataques temáticos sinalizados
- Três personagens e três armas
- Progressão permanente, desbloqueios e upgrades
- Salvamento local
- HUD, pausa, resultado, configurações, partículas e áudio procedural
