import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '../src/App';
import { parseKitSlug } from '../src/lib/fka';
import { compareTeams, extractFkaLinks, matchLinksToShirts } from '../src/lib/fkaMatch';
import { MemoryShirtRepository } from '../src/services/memoryShirtRepository';
import { makeInput } from './helpers';

const IMG = 'https://www.footballkitarchive.com/cdn/2019/06/1yuK2AVc4MpDG7J/camiseta-local-borussia-dortmund-2016-17.jpg';

describe('parseKitSlug amb formats reals', () => {
  it('fitxers i fitxes', () => {
    expect(parseKitSlug('camiseta-local-borussia-dortmund-2016-17.jpg')).toMatchObject({ teamTokens: ['borussia', 'dortmund'], season: '2016-17', kitType: 'home', variant: false });
    expect(parseKitSlug('borussia-dortmund-2016-17-away-kit-110')).toMatchObject({ season: '2016-17', kitType: 'away', variant: false });
    expect(parseKitSlug('borussia-dortmund-2016-17-gk-2-kit').variant).toBe(true);
    expect(parseKitSlug('borussia-dortmund-2016-17-champions-league-home-kit').variant).toBe(true);
    expect(parseKitSlug('borussia-dortmund-2016-17-track-jacket-370048').notShirt).toBe(true);
    expect(parseKitSlug('borussia-dortmund-l85').isListing).toBe(true);
  });
});

describe('extractFkaLinks', () => {
  it('troba enllaços en text lliure, ignora no-samarretes, llistats i altres dominis, i dedupica', () => {
    const text = `${IMG}, ${IMG}
      <a href="https://www.footballkitarchive.com/es/ajax-2021-22-third-kit/">x</a>
      https://www.footballkitarchive.com/es/borussia-dortmund-2016-17-track-jacket-370048/
      https://www.footballkitarchive.com/es/borussia-dortmund-l85/
      https://evil.test/camiseta-local-ajax-2020-21.jpg`;
    const links = extractFkaLinks(text);
    expect(links.map((l) => l.kind)).toEqual(['image', 'page']);
  });
  it('prefereix la imatge sense mida', () => {
    const sized = IMG.replace('.jpg', '-300x300.jpg');
    const [m] = matchLinksToShirts(extractFkaLinks(`${sized} ${IMG}`), [shirt('Borussia Dortmund', '2016-17', 'home')]).matches;
    expect(m.group.imageUrl).toBe(IMG);
  });
});

function shirt(team: string, season: string | null, kit: 'home' | 'away' | 'third' | null, id = team + season + kit) {
  return { id, team: { name: team }, season, kitType: kit, photoUrl: null } as never;
}

describe('compareTeams', () => {
  it('sinònims i accents', () => {
    expect(compareTeams('Dinamarca', ['denmark'])).toBe('equal');
    expect(compareTeams('Atlètic de Madrid', ['atletico', 'madrid'])).toBe('equal');
    expect(compareTeams('Borussia Dortmund', ['borussia', 'dortmund'])).toBe('equal');
    expect(compareTeams('Ajax', ['psv'])).toBe('none');
  });
});

describe('matchLinksToShirts', () => {
  const links = extractFkaLinks(`${IMG} https://www.footballkitarchive.com/borussia-dortmund-2016-17-away-kit-110/`);
  it('exacta només amb equip, temporada i equipació iguals; mai amb equipació diferent', () => {
    const r = matchLinksToShirts(links, [shirt('Borussia Dortmund', '2016-17', 'home'), shirt('Borussia Dortmund', '2016-17', 'third')]);
    expect(r.matches).toHaveLength(1);
    expect(r.matches[0]).toMatchObject({ level: 'exact' });
    expect(r.withoutMatch).toHaveLength(1);
  });
  it('equipació desconeguda = probable; sense temporada = cap', () => {
    const r = matchLinksToShirts(links, [shirt('Borussia Dortmund', '2016-17', null), shirt('Borussia Dortmund', null, 'home')]);
    expect(r.matches.map((m) => m.level)).toEqual(['probable']);
  });
  it('no toca samarretes que ja tenen foto', () => {
    const s = { ...(shirt('Borussia Dortmund', '2016-17', 'home') as object), photoUrl: 'https://x.test/a.jpg' } as never;
    const r = matchLinksToShirts(links, [s]);
    expect(r.matches).toHaveLength(0);
    expect(r.protectedCount).toBe(1);
  });
  it('dues samarretes iguals: es marquen a revisar', () => {
    const r = matchLinksToShirts(links, [shirt('Borussia Dortmund', '2016-17', 'home', 'a'), shirt('Borussia Dortmund', '2016-17', 'home', 'b')]);
    expect(r.matches.every((m) => m.level === 'probable')).toBe(true);
  });
});

describe('diàleg en bloc', () => {
  it('enganxa enllaços, preselecciona l’exacte i l’aplica amb la font FKA', async () => {
    const user = userEvent.setup();
    const repo = new MemoryShirtRepository();
    await repo.createShirt(makeInput({ teamName: 'Borussia Dortmund', season: '2016-17', kitType: 'home' }));
    await repo.createShirt(makeInput({ teamName: 'Ajax', season: '2021-22', kitType: 'third' }));
    render(<App repository={repo} />);
    await user.click(await screen.findByRole('button', { name: 'Des de Football Kit Archive' }));
    const dialog = await screen.findByRole('dialog', { name: 'Enllaça imatges de Football Kit Archive' });
    await user.click(within(dialog).getByLabelText('Enllaços de Football Kit Archive'));
    await user.paste(IMG);
    await user.click(within(dialog).getByRole('button', { name: 'Analitza i busca coincidències' }));
    const box = within(dialog).getByRole('checkbox', { name: /Aplica a Borussia Dortmund/ });
    expect(box).toBeChecked();
    await user.click(within(dialog).getByRole('button', { name: 'Aplica 1 seleccionades' }));
    await waitFor(async () => expect((await repo.listImages()).length).toBe(1));
    const [img] = await repo.listImages();
    expect(img).toMatchObject({ imageUrl: IMG, source: 'footballkitarchive', status: 'confirmed' });
    expect(await screen.findByRole('status')).toHaveTextContent(/enllaçat 1 imatges/);
  });
});
